import { Hono } from 'hono'
import { renderer } from './renderer'
import { Bindings } from './types'
import { raw } from 'hono/html'

const app = new Hono<{ Bindings: Bindings }>()

app.use(renderer)

app.get('/', (c) => {
  return c.render(
    <>
      <h2>Question</h2>
      <form action="/answer/ui" method="get">
        <input name="text" autocomplete="off" autofocus={true} />
        <button>Send</button>
      </form>
      <h2>Add notes</h2>
      <form action="/notes" method="post">
        <textarea name="text" rows={6} />
        <button>Send</button>
      </form>
    </>
  )
})

app.get('/answer/ui', (c) => {
  const { text } = c.req.query()
  if (!text) {
    return c.redirect('/')
  }
  return c.render(
    <>
      <h2>Question</h2>
      <p>{text}</p>
      <h2>Answer</h2>
      {raw`<script>
        const url = new URL(location.href)
        const eventSource = new EventSource("/answer?" + url.searchParams.toString());
        eventSource.onmessage = function(event) {
          if (event.data === '[DONE]') {
            eventSource.close()
            return
          }
          const data = JSON.parse(event.data);
          if (data.response !== undefined) {
            document.getElementById('output').innerText += data.response;
          }
        }
        </script>`}
      <pre
        id="output"
        style={{
          padding: '1rem',
          'white-space': 'pre-wrap',
          color: '#333'
        }}
      ></pre>
    </>
  )
})

app.get('/answer', async (c) => {
  const question = c.req.query('text') || 'What is the square root of 9?'

  const embeddings = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: question })

  const vectors = embeddings.data[0]
  const SIMILARITY_CUTOFF = 0.75
  const vectorQuery = await c.env.VECTORIZE_INDEX.query(vectors, { topK: 10 })

  const vecIds = vectorQuery.matches.filter((vec) => vec.score > SIMILARITY_CUTOFF).map((vec) => vec.id)

  let notes: string[] = []
  if (vecIds.length) {
    const query = `SELECT * FROM notes WHERE id IN (${vecIds.join(', ')})`
    const { results } = await c.env.DB.prepare(query).bind().all()
    if (results) {
      notes = results.map((vec) => vec.text as string)
    }
  }

  const contextMessage = notes.length ? `Context:\n${notes.map((note) => `- ${note}`).join('\n')}` : ''
  const systemPrompt = `Answer the given question based on only the context.`
  const messages: RoleScopedChatInput[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question }
  ]

  if (notes.length) {
    messages.unshift({ role: 'system', content: contextMessage })
  }

  const results = (await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages,
    stream: true
  })) as ReadableStream

  return c.body(results, {
    headers: {
      'Content-Type': 'text/event-stream;charset=UTF-8',
      'Transfer-Encoding': 'chunked'
    }
  })
})

app.post('/notes', async (c) => {
  let { text } = await c.req.parseBody<{ text: string }>()
  if (!text) {
    return c.redirect('/')
  }

  const result = await c.env.DB.prepare('INSERT INTO notes (text) VALUES (?)').bind(text).run()

  if (!result.success) {
    return c.text('Failed to create note', 500)
  }

  const { data } = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [text] })
  const values = data[0]

  if (!values) {
    return c.text('Failed to generate vector embedding', 500)
  }

  const id = result.meta.last_row_id
  await c.env.VECTORIZE_INDEX.upsert([
    {
      id: id.toString(),
      values
    }
  ])

  return c.redirect('/')
})

export default app

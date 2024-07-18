import { Hono } from 'hono'

type Bindings = {
  AI: Ai
  DB: D1Database
  VECTORIZE_INDEX: VectorizeIndex
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const question = c.req.query('text') || 'What is the square root of 9?'

  const embeddings = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: question })

  const vectors = embeddings.data[0]
  const SIMILARITY_CUTOFF = 0.75
  const vectorQuery = await c.env.VECTORIZE_INDEX.query(vectors, { topK: 1 })
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
  const systemPrompt = `When answering the question or responding, use the context provided, if it is provided and relevant.`
  const messages: RoleScopedChatInput[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question }
  ]
  if (notes.length) {
    messages.unshift({ role: 'system', content: contextMessage })
  }

  const results = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', { messages })

  if (results instanceof ReadableStream) {
    return c.body(results)
  }

  return c.text(results.response!)
})

app.post('/notes', async (c) => {
  const { text } = await c.req.json()
  if (!text) {
    return c.text('Missing text', 400)
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
  const inserted = await c.env.VECTORIZE_INDEX.upsert([
    {
      id: id.toString(),
      values
    }
  ])

  return c.json({ id, text, inserted })
})

export default app

import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.classless.min.css" />
      </head>
      <body>
        <header>
          <h1>
            <a href="/">My first RAG</a>
          </h1>
        </header>
        <main class="container">{children}</main>
      </body>
    </html>
  )
})

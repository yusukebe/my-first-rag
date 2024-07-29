# My first RAG

This is my first RAG (Retrieval Augmented Generative) application. It uses Cloudflare Workers and Cloudflare's Workers AI.

This application is based on the [example](https://github.com/kristianfreeman/cloudflare-retrieval-augmented-generation-example) used in [Cloudflare's tutorial](https://developers.cloudflare.com/workers-ai/tutorials/build-a-retrieval-augmented-generation-ai/).

## Stack

The technology stack used includes:

- Cloudflare Workers
- Workers AI
- Vectorize
- D1

Additionally, SSE (Server-Sent Events) is used for rendering results, allowing text to be displayed in a stream.

## Demo

Using technical documents as the content for RAG yielded good results.

![DEMO](https://github.com/user-attachments/assets/8b36bfef-2009-4f59-8eb0-e1801cf3dec3)

## Usage

### Installation

```sh
clone git@github.com:yusukebe/my-first-rag.git
cd my-first-rag
npm i
```

### Create the D1 database

```sh
npm run wrangler --remote d1 create database-my-first-rag
```

### Create the Vectorize database

```sh
npm run wrangler vectorize create vector-index-my-first-rag --dimensions=768 --metric=cosine
```

### Edit `wrangler.toml`

```toml
[[vectorize]]
binding = "VECTORIZE_INDEX"
index_name = "vector-index-my-first-rag"

[[d1_databases]]
binding = "DB"
database_name = "database-my-first-rag"
database_id = "xxxxxxxx" # <== edit!
```

### Start the application

```sh
npm run dev
```

## Author

Yusuke Wada

## License

MIT

import fs from 'node:fs'
import { parse } from 'csv-parse'

const csvPath = new URL('./tasks.csv', import.meta.url)

async function run() {
  const stream = fs.createReadStream(csvPath)

  const parser = stream.pipe(
    parse({
      delimiter: ',',
      from_line: 2, // pula o cabeçalho (title,description)
    }),
  )

  for await (const record of parser) {
    const [title, description] = record

    if (!title || !description) {
      continue
    }

    await fetch('http://localhost:3333/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, description }),
    }).catch((err) => {
      console.error('Erro ao enviar tarefa:', title, err.message)
    })

    console.log(`Tarefa importada: ${title}`)
  }

  console.log('✅ Importação concluída.')
}

run().catch((err) => {
  console.error('Erro na importação:', err)
})

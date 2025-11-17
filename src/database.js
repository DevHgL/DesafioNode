// src/database.js
import fs from 'node:fs/promises'

const databasePath = new URL('../db.json', import.meta.url)

export class Database {
  #database = {}

  constructor() {
    fs.readFile(databasePath, 'utf-8')
      .then((data) => {
        this.#database = JSON.parse(data)
      })
      .catch(() => {
        this.#persist()
      })
  }

  #persist() {
    return fs.writeFile(databasePath, JSON.stringify(this.#database, null, 2))
  }

  select(table, search) {
    let data = this.#database[table] ?? []

    if (search && Object.keys(search).length > 0) {
      data = data.filter((row) => {
        return Object.entries(search).some(([key, value]) => {
          const field = String(row[key] ?? '').toLowerCase()
          return field.includes(String(value).toLowerCase())
        })
      })
    }

    return data
  }

  insert(table, data) {
    if (!this.#database[table]) {
      this.#database[table] = []
    }

    this.#database[table].push(data)
    this.#persist()

    return data
  }

  update(table, id, data) {
    const rows = this.#database[table] ?? []
    const index = rows.findIndex((row) => row.id === id)

    if (index === -1) {
      return null
    }

    const updated = { ...rows[index], ...data }
    this.#database[table][index] = updated
    this.#persist()

    return updated
  }

  delete(table, id) {
    const rows = this.#database[table] ?? []
    const index = rows.findIndex((row) => row.id === id)

    if (index === -1) {
      return false
    }

    rows.splice(index, 1)
    this.#database[table] = rows
    this.#persist()

    return true
  }

  findById(table, id) {
    const rows = this.#database[table] ?? []
    return rows.find((row) => row.id === id) ?? null
  }
}

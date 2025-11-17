// src/middlewares/json.js
export async function json(req, res) {
  const buffers = []

  for await (const chunk of req) {
    buffers.push(chunk)
  }

  try {
    const fullBody = Buffer.concat(buffers).toString()
    req.body = fullBody ? JSON.parse(fullBody) : {}
  } catch (err) {
    req.body = {}
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8')
}

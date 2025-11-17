import "dotenv/config";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// helper para ler JSON do body
async function parseJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        return resolve({});
      }

      try {
        const bodyString = Buffer.concat(chunks).toString();
        const body = bodyString ? JSON.parse(bodyString) : {};
        resolve(body);
      } catch (err) {
        resolve({});
      }
    });

    req.on("error", () => {
      resolve({});
    });
  });
}

const requestHandler = async (req, res) => {
  const { method, url } = req;
  const fullUrl = new URL(url, `http://${req.headers.host}`);
  const pathname = fullUrl.pathname;
  const search = fullUrl.searchParams.get("search");

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    // ------------------------------------------------------------------
    // POST /tasks
    // ------------------------------------------------------------------
    if (method === "POST" && pathname === "/tasks") {
      const body = await parseJsonBody(req);
      const { title, description } = body;

      // validar title e description
      if (!title || !description) {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({
            message: 'As propriedades "title" e "description" são obrigatórias.',
          })
        );
      }

      const id = randomUUID();
      const now = new Date().toISOString();

      const result = await sql`
        INSERT INTO tasks (id, title, description, completed_at, created_at, updated_at)
        VALUES (${id}, ${title}, ${description}, NULL, ${now}, ${now})
        RETURNING *;
      `;

      const task = result[0];

      res.statusCode = 201;
      return res.end(JSON.stringify(task));
    }

    // ------------------------------------------------------------------
    // GET /tasks  (lista e/ou busca)
    // Busca: /tasks?search=texto  -> filtra por title OU description
    // ------------------------------------------------------------------
    if (method === "GET" && pathname === "/tasks") {
      let tasks;

      if (search) {
        const pattern = `%${search}%`;
        tasks = await sql`
          SELECT * FROM tasks
          WHERE title ILIKE ${pattern}
             OR description ILIKE ${pattern}
          ORDER BY created_at DESC;
        `;
      } else {
        tasks = await sql`
          SELECT * FROM tasks
          ORDER BY created_at DESC;
        `;
      }

      res.statusCode = 200;
      return res.end(JSON.stringify(tasks));
    }

    // ------------------------------------------------------------------
    // PUT /tasks/:id
    // Atualiza title e/ou description, e updated_at
    // ------------------------------------------------------------------
    if (method === "PUT" && /^\/tasks\/[^/]+$/.test(pathname)) {
      const id = pathname.split("/")[2];

      const body = await parseJsonBody(req);
      const { title, description } = body;

      // validar que pelo menos um campo foi enviado
      if (!title && !description) {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({
            message:
              'Informe ao menos uma das propriedades "title" ou "description" para atualizar.',
          })
        );
      }

      // verificar se registro existe
      const existing = await sql`
        SELECT * FROM tasks WHERE id = ${id};
      `;

      if (existing.length === 0) {
        res.statusCode = 404;
        return res.end(
          JSON.stringify({
            message: "Registro não existe.",
          })
        );
      }

      const now = new Date().toISOString();

      // atualiza apenas o que veio no body (COALESCE mantém valor antigo se vier null/undefined)
      const updated = await sql`
        UPDATE tasks
        SET
          title       = COALESCE(${title}, title),
          description = COALESCE(${description}, description),
          updated_at  = ${now}
        WHERE id = ${id}
        RETURNING *;
      `;

      res.statusCode = 200;
      return res.end(JSON.stringify(updated[0]));
    }

    // ------------------------------------------------------------------
    // DELETE /tasks/:id
    // ------------------------------------------------------------------
    if (method === "DELETE" && /^\/tasks\/[^/]+$/.test(pathname)) {
      const id = pathname.split("/")[2];

      // verifica se existe
      const existing = await sql`
        SELECT 1 FROM tasks WHERE id = ${id};
      `;

      if (existing.length === 0) {
        res.statusCode = 404;
        return res.end(
          JSON.stringify({
            message: "Registro não existe.",
          })
        );
      }

      await sql`
        DELETE FROM tasks WHERE id = ${id};
      `;

      res.statusCode = 204;
      return res.end();
    }

    // ------------------------------------------------------------------
    // PATCH /tasks/:id/completea  (exatamente como no enunciado)
    // Alterna entre completa / não completa
    // ------------------------------------------------------------------
    if (
      method === "PATCH" &&
      /^\/tasks\/[^/]+\/completea$/.test(pathname)
    ) {
      const parts = pathname.split("/").filter(Boolean); // ['tasks', ':id', 'completea']
      const id = parts[1];

      const existing = await sql`
        SELECT * FROM tasks WHERE id = ${id};
      `;

      if (existing.length === 0) {
        res.statusCode = 404;
        return res.end(
          JSON.stringify({
            message: "Registro não existe.",
          })
        );
      }

      const task = existing[0];
      let completed_at = task.completed_at;

      if (completed_at) {
        // se já estava completa, volta para não completa (null)
        completed_at = null;
      } else {
        // se não estava, marca como completa agora
        completed_at = new Date().toISOString();
      }

      const now = new Date().toISOString();

      const updated = await sql`
        UPDATE tasks
        SET
          completed_at = ${completed_at},
          updated_at   = ${now}
        WHERE id = ${id}
        RETURNING *;
      `;

      res.statusCode = 200;
      return res.end(JSON.stringify(updated[0]));
    }

    // ------------------------------------------------------------------
    // Se nenhuma rota bater: 404
    // ------------------------------------------------------------------
    res.statusCode = 404;
    return res.end(JSON.stringify({ message: "Rota não encontrada." }));
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    return res.end(JSON.stringify({ message: "Erro interno do servidor." }));
  }
};

const PORT = process.env.PORT || 3333;

http.createServer(requestHandler).listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  const db = env.DB;
  
  if (!db) {
    return Response.json({ data: null, error: { message: "D1 Database binding 'DB' not found." } }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { table, action, cols, wheres, orders, limit, payload, isSingle } = body;

    let query = '';
    let params: any[] = [];

    // Build WHERE clause
    let whereClause = '';
    if (wheres && wheres.length > 0) {
      const clauses = wheres.map((w: any) => {
        if (w.op === 'IN') {
          const placeholders = w.val.map(() => '?').join(',');
          params.push(...w.val.map((v: any) => v === undefined ? null : v));
          return `${w.col} IN (${placeholders})`;
        } else {
          params.push(w.val === undefined ? null : w.val);
          return `${w.col} ${w.op} ?`;
        }
      });
      whereClause = ` WHERE ${clauses.join(' AND ')}`;
    }

    if (action === 'select') {
      // Handle nested selects like '*, profiles(name, avatar)' by simplifying them to '*' for now
      // A proper relational mapper would be needed for complex joins, but for this prototype we fetch '*'
      const safeCols = cols.includes('(') ? '*' : cols;
      query = `SELECT ${safeCols} FROM ${table}${whereClause}`;
      
      if (orders && orders.length > 0) {
        const orderClauses = orders.map((o: any) => `${o.col} ${o.ascending ? 'ASC' : 'DESC'}`);
        query += ` ORDER BY ${orderClauses.join(', ')}`;
      }
      if (limit) query += ` LIMIT ${limit}`;
      
    } else if (action === 'insert') {
      const isArray = Array.isArray(payload);
      const items = isArray ? payload : [payload];
      if (items.length === 0) return Response.json({ data: [] });
      
      // Auto-generate id if missing
      items.forEach(item => {
        const noIdTables = ['community_collection_items', 'club_members', 'anime_seo', 'anime_episodes_tracker', 'anime_codes'];
        if (!item.id && !noIdTables.includes(table)) {
          item.id = crypto.randomUUID();
        }
      });

      const keys = Object.keys(items[0]);
      const placeholders = keys.map(() => '?').join(', ');
      const values = items.map(item => keys.map(k => item[k] === undefined ? null : item[k]));
      
      const rowPlaceholders = items.map(() => `(${placeholders})`).join(', ');
      query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES ${rowPlaceholders} RETURNING *`;
      params = values.flat();
      
    } else if (action === 'update') {
      const keys = Object.keys(payload);
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      params.unshift(...keys.map(k => payload[k] === undefined ? null : payload[k])); // Add update values before where values
      query = `UPDATE ${table} SET ${setClause}${whereClause} RETURNING *`;
      
    } else if (action === 'delete') {
      query = `DELETE FROM ${table}${whereClause} RETURNING *`;
    } else if (action === 'rpc') {
      // Call a stored procedure or custom logic
      // For D1, we might need to implement the logic here
      if (table === 'increment_topic_views') {
        query = `UPDATE forum_topics SET views = views + 1 WHERE id = ? RETURNING *`;
        params = [payload.topic_id];
      } else if (table === 'increment_topic_replies') {
        query = `UPDATE forum_topics SET replies_count = replies_count + 1 WHERE id = ? RETURNING *`;
        params = [payload.topic_id];
      }
    }

    const stmt = db.prepare(query).bind(...params);
    let result;
    try {
      result = await stmt.all();
    } catch (e: any) {
      // Auto-migrate if column is missing
      if (e.message && e.message.includes('cover_image')) {
        try {
          await db.prepare('ALTER TABLE community_collections ADD COLUMN cover_image TEXT').run();
          // Retry the original query
          result = await stmt.all();
        } catch (e2) {
          throw e; // throw original error if migration fails
        }
      } else {
        throw e;
      }
    }

    let data = result.results;
    
    // Mocking the joined profiles data for relations since D1 doesn't auto-join like PostgREST
    // If the original query requested joined profiles, we should ideally fetch them here.
    // For simplicity in this migration, we return the raw data. The frontend might need adjustments
    // or we can do a quick manual join here if table has user_id/author_id/email.
    if (cols && cols.includes('profiles(') && data.length > 0) {
      const profileIds = [...new Set(data.map((d: any) => d.user_id || d.author_id || d.creator_id || d.reporter_id).filter(Boolean))];
      const profileEmails = [...new Set(data.map((d: any) => d.user_email || d.email).filter(Boolean))];
      
      let profiles: any[] = [];
      if (profileIds.length > 0) {
        const pStmt = db.prepare(`SELECT * FROM profiles WHERE id IN (${profileIds.map(() => '?').join(',')})`).bind(...profileIds);
        profiles = profiles.concat((await pStmt.all()).results);
      }
      if (profileEmails.length > 0) {
        const pStmt = db.prepare(`SELECT * FROM profiles WHERE email IN (${profileEmails.map(() => '?').join(',')})`).bind(...profileEmails);
        profiles = profiles.concat((await pStmt.all()).results);
      }
      
      data = data.map((d: any) => {
        const profile = profiles.find(p => p.id === (d.user_id || d.author_id || d.creator_id || d.reporter_id) || p.email === (d.user_email || d.email));
        if (profile) {
          return { ...d, profiles: profile };
        }
        return d;
      });
    }

    if (cols && cols.includes('community_collection_items(') && data.length > 0) {
      const collectionIds = [...new Set(data.map((d: any) => d.id).filter(Boolean))];
      if (collectionIds.length > 0) {
        const iStmt = db.prepare(`SELECT * FROM community_collection_items WHERE collection_id IN (${collectionIds.map(() => '?').join(',')})`).bind(...collectionIds);
        const items = (await iStmt.all()).results;
        data = data.map((d: any) => {
          return { ...d, community_collection_items: items.filter((i: any) => i.collection_id === d.id) };
        });
      }
    }

    if (isSingle) {
      data = data.length > 0 ? data[0] : null;
    }

    return Response.json({ data, error: null });
  } catch (e: any) {
    console.error("D1 Query Error:", e);
    return Response.json({ data: null, error: { message: e.message } });
  }
};

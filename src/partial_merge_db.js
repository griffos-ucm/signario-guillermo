const { app } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { mainGetDB } = require('./common/back.js');

module.exports = async function partial_merge_db (db_to_merge, options) {

  const { data, entries } = options;
  const { gloss: importGloss, flags: importFlags, attachments: importAttachments } = data;

  const db = mainGetDB();
  db.pragma("foreign_keys = ON");
  const last_merge = db.prepare("SELECT value FROM config WHERE key = 'last_merge'").pluck().get();

  const user_path = app.getPath('userData');
  const ext_path = path.join(user_path, 'signario.db.ext');

  await fs.copyFile(db_to_merge, ext_path);
  db.exec(`ATTACH '${ext_path}' AS ext_db`);

  try {
    // Build temp table of candidate entries from external DB based on 'entries' filter
    if (entries === 'newer_in_external') {
      db.prepare(`CREATE TEMP TABLE import_candidates AS
        SELECT * FROM ext_db.signs WHERE modified_at > :last_merge`)
        .run({ last_merge });
    } else if (entries === 'not_in_ours') {
      db.exec(`CREATE TEMP TABLE import_candidates AS
        SELECT ext.* FROM ext_db.signs AS ext
        WHERE NOT EXISTS (SELECT 1 FROM main.signs WHERE number = ext.number)`);
    } else { // 'all'
      db.exec(`CREATE TEMP TABLE import_candidates AS
        SELECT * FROM ext_db.signs`);
    }

    // Find conflicts: candidate modified after last_merge AND our version also modified after last_merge
    const conflicts = db.prepare(`
      SELECT c.number, c.gloss AS ext_gloss, c.modified_at AS ext_modified_at,
             c.modified_by AS ext_modified_by,
             our.gloss AS our_gloss, our.modified_at AS our_modified_at,
             our.modified_by AS our_modified_by
      FROM import_candidates AS c
      JOIN main.signs AS our USING(number)
      WHERE our.modified_at > :last_merge AND c.modified_at > :last_merge`)
      .all({ last_merge });

    const report_path = path.join(app.getPath('home'), 'GUILLERMO_IMPORT_REPORT.txt');
    if (conflicts.length > 0) {
      await fs.writeFile(report_path,
        "CONFLICTOS EN IMPORTACIÓN PARCIAL\n\n" +
        "Se conservó la versión local (más reciente) para las siguientes entradas:\n\n" +
        conflicts.map(row =>
          `Seña ${row.number}: "${row.our_gloss}" (local: ${row.our_modified_at} por ${row.our_modified_by}) ` +
          `vs "${row.ext_gloss}" (externa: ${row.ext_modified_at} por ${row.ext_modified_by})\n`)
        .join(''));
    }

    // Entries to actually import: candidates without conflict where external is newer or entry is new
    db.prepare(`CREATE TEMP TABLE to_import AS
      SELECT c.* FROM import_candidates AS c
      LEFT JOIN main.signs AS our USING(number)
      WHERE NOT (our.modified_at > :last_merge AND c.modified_at > :last_merge)
        AND (our.number IS NULL OR c.modified_at > our.modified_at)`)
      .run({ last_merge });

    const count = db.prepare("SELECT count(*) FROM to_import").pluck().get();

    if (count > 0) {
      if (importGloss) {
        db.exec(`INSERT OR REPLACE INTO main.signs(number, gloss, notation, modified_at, modified_by)
          SELECT number, gloss, notation, modified_at, modified_by FROM to_import`);
      }

      if (importFlags) {
        // Ensure any new flag definitions from external DB exist in our DB
        db.exec(`INSERT INTO flags(icon, name)
          SELECT ext_db.flags.icon, ext_db.flags.name FROM ext_db.flags
          LEFT JOIN main.flags USING(icon)
          WHERE main.flags.id IS NULL`);

        // Map external flag IDs to our flag IDs (by icon)
        db.exec(`CREATE TEMP TABLE import_flag_map AS
          SELECT ext_db.flags.id AS ext_flag, main.flags.id AS our_flag
          FROM ext_db.flags JOIN main.flags USING(icon)`);

        // Replace flag assignments for imported entries
        db.exec(`DELETE FROM main.signFlags WHERE sign IN (SELECT number FROM to_import)`);
        db.exec(`INSERT OR IGNORE INTO main.signFlags(sign, flag)
          SELECT esf.sign, import_flag_map.our_flag AS flag
          FROM ext_db.signFlags AS esf
            JOIN import_flag_map ON import_flag_map.ext_flag = esf.flag
            JOIN to_import ON to_import.number = esf.sign`);
      }

      if (importAttachments) {
        db.exec(`INSERT OR REPLACE INTO main.attachments
          SELECT ea.* FROM ext_db.attachments AS ea
          JOIN to_import ON to_import.number = ea.sign`);
      }
    }

    db.prepare("UPDATE config SET value = datetime('now') WHERE key = 'last_merge'").run();

    return [conflicts.length, report_path];
  } finally {
    db.exec("DETACH ext_db");
    db.close();
    await fs.unlink(ext_path).catch(() => {});
  }
};

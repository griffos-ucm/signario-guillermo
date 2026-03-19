const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { mainGetDB } = require('./common/back.js');

function openWithExt(extPath) {
    const db = mainGetDB();
    db.pragma('foreign_keys = ON');
    db.exec(`ATTACH '${extPath.replace(/'/g, "''")}' AS ext`);
    return db;
}

function getLastMerge(db) {
    return db.prepare("SELECT value FROM config WHERE key = 'last_merge'").pluck().get();
}

function groupBy(rows, key) {
    const map = new Map();
    for (const row of rows) {
        if (!map.has(row[key])) map.set(row[key], []);
        map.get(row[key]).push(row);
    }
    return map;
}

function hasTable(db, schema, name) {
    return db.prepare(`SELECT count(*) FROM ${schema}.sqlite_master WHERE type='table' AND name=?`).pluck().get(name) > 0;
}

// ── Analysis ────────────────────────────────────────────────────────────

exports.analyzeImport = function (extPath) {
    const db = openWithExt(extPath);
    const last_merge = getLastMerge(db);
    const extHasAttachments = hasTable(db, 'ext', 'attachments');
    const extHasFlags = hasTable(db, 'ext', 'flags');

    const result = {
        definitions: { added: 0, modified: 0 },
        notation:    { added: 0, modified: 0, conflicts: 0 },
        comments:    { added: 0, modified: 0 },
        flags:       { changed: 0 },
    };

    // ── Definitions ──
    if (extHasAttachments) {
        const local = db.prepare("SELECT sign, id, content FROM attachments WHERE type='definition' ORDER BY sign, id").all();
        const ext   = db.prepare("SELECT sign, id, content FROM ext.attachments WHERE type='definition' ORDER BY sign, id").all();
        const localMap = groupBy(local, 'sign');
        const extMap   = groupBy(ext, 'sign');

        for (const [sign, defs] of extMap) {
            if (!localMap.has(sign)) {
                result.definitions.added++;
            } else {
                const lc = localMap.get(sign).map(d => '' + d.content);
                const ec = defs.map(d => '' + d.content);
                if (lc.length !== ec.length || lc.some((c, i) => c !== ec[i])) {
                    result.definitions.modified++;
                }
            }
        }
    }

    // ── Notation ──
    result.notation.added = db.prepare(`
        SELECT count(*) FROM ext.signs e JOIN signs s USING(number)
        WHERE e.notation != '' AND (s.notation = '' OR s.notation IS NULL)
    `).pluck().get();

    result.notation.modified = db.prepare(`
        SELECT count(*) FROM ext.signs e JOIN signs s USING(number)
        WHERE s.notation != '' AND e.notation != '' AND e.notation != s.notation
        AND s.modified_at <= :last_merge
    `).pluck().get({ last_merge });

    result.notation.conflicts = db.prepare(`
        SELECT count(*) FROM ext.signs e JOIN signs s USING(number)
        WHERE s.notation != '' AND e.notation != '' AND e.notation != s.notation
        AND s.modified_at > :last_merge
    `).pluck().get({ last_merge });

    // ── Comments ──
    if (extHasAttachments) {
        const local = db.prepare("SELECT sign, content FROM attachments WHERE type='comment'").all();
        const ext   = db.prepare("SELECT sign, content FROM ext.attachments WHERE type='comment'").all();
        const localMap = new Map(local.map(r => [r.sign, '' + r.content]));

        for (const r of ext) {
            if (!localMap.has(r.sign)) {
                result.comments.added++;
            } else if (localMap.get(r.sign) !== '' + r.content) {
                result.comments.modified++;
            }
        }
    }

    // ── Flags ──
    if (extHasFlags && hasTable(db, 'ext', 'signFlags')) {
        result.flags.changed = db.prepare(`
            SELECT count(DISTINCT sub.sign) FROM (
                SELECT sf.sign, f.icon FROM ext.signFlags sf JOIN ext.flags f ON sf.flag = f.id
                EXCEPT
                SELECT sf.sign, f.icon FROM signFlags sf JOIN flags f ON sf.flag = f.id
            ) sub
        `).pluck().get();
    }

    db.exec('DETACH ext');
    db.close();
    return result;
};

// ── Execution ───────────────────────────────────────────────────────────

exports.executeImport = function (extPath, options) {
    // Backup
    const dbPath = path.join(app.getPath('userData'), 'signario.db');
    fs.copyFileSync(dbPath, dbPath + '.bak');

    const db = openWithExt(extPath);
    const last_merge = getLastMerge(db);
    const overwrite = options.strategy === 'overwrite';
    const report = [];
    const extHasAttachments = hasTable(db, 'ext', 'attachments');
    const extHasFlags = hasTable(db, 'ext', 'flags');

    const getGloss = db.prepare("SELECT gloss FROM signs WHERE number = ?").pluck();

    db.transaction(() => {
        if (options.categories.definitions && extHasAttachments) {
            importDefinitions(db, overwrite, report, getGloss);
        }
        if (options.categories.notation) {
            importNotation(db, last_merge, overwrite, report, getGloss);
        }
        if (options.categories.comments && extHasAttachments) {
            importComments(db, overwrite, report, getGloss);
        }
        if (options.categories.flags && extHasFlags && hasTable(db, 'ext', 'signFlags')) {
            importFlags(db, overwrite, report, getGloss);
        }
    })();

    db.exec('DETACH ext');
    db.close();

    let reportPath = null;
    if (options.generateReport && report.length > 0) {
        reportPath = path.join(app.getPath('home'), 'GUILLERMO_CONFLICTOS.txt');
        const header = [
            'INFORME DE IMPORTACIÓN PARCIAL',
            `Fecha: ${new Date().toLocaleString()}`,
            `Archivo: ${extPath}`,
            `Estrategia: ${overwrite ? 'Sobreescribir con datos externos' : 'Mantener datos locales'}`,
            '', '',
        ].join('\n');
        fs.writeFileSync(reportPath, header + report.join('\n'));
    }

    return { success: true, reportPath };
};

// ── Import helpers ──────────────────────────────────────────────────────

function importDefinitions(db, overwrite, report, getGloss) {
    const local = db.prepare("SELECT sign, id, content FROM attachments WHERE type='definition' ORDER BY sign, id").all();
    const ext   = db.prepare("SELECT sign, id, content FROM ext.attachments WHERE type='definition' ORDER BY sign, id").all();
    const localMap = groupBy(local, 'sign');
    const extMap   = groupBy(ext, 'sign');

    const delDefs = db.prepare("DELETE FROM attachments WHERE sign = ? AND type = 'definition'");
    const insDef  = db.prepare(`INSERT INTO attachments(sign, id, type, content)
        VALUES (?, (SELECT COALESCE(MAX(id),-1)+1 FROM attachments WHERE sign = ?), 'definition', ?)`);

    for (const [sign, defs] of extMap) {
        const isNew = !localMap.has(sign);
        if (isNew) {
            // Always import new definitions
            for (const d of defs) insDef.run(sign, sign, d.content);
            report.push(`ACEPCIONES - Signo ${sign} (${getGloss.get(sign)}): ${defs.length} acepciones nuevas importadas`);
        } else {
            const lc = localMap.get(sign).map(d => '' + d.content);
            const ec = defs.map(d => '' + d.content);
            const differs = lc.length !== ec.length || lc.some((c, i) => c !== ec[i]);
            if (differs && overwrite) {
                delDefs.run(sign);
                for (const d of defs) insDef.run(sign, sign, d.content);
                report.push(`ACEPCIONES - Signo ${sign} (${getGloss.get(sign)}): sobreescritas (${lc.length} → ${ec.length})`);
            } else if (differs) {
                report.push(`ACEPCIONES - Signo ${sign} (${getGloss.get(sign)}): diferencias ignoradas (mantener local)`);
            }
        }
    }
}

function importNotation(db, last_merge, overwrite, report, getGloss) {
    const updNotation = db.prepare("UPDATE signs SET notation = ? WHERE number = ?");

    // Added: ext has notation, local is empty
    const added = db.prepare(`
        SELECT e.number, e.notation FROM ext.signs e JOIN signs s USING(number)
        WHERE e.notation != '' AND (s.notation = '' OR s.notation IS NULL)
    `).all();
    for (const r of added) {
        updNotation.run(r.notation, r.number);
        report.push(`SIGNOTACIÓN - Signo ${r.number} (${getGloss.get(r.number)}): notación nueva importada`);
    }

    // Modified: both have notation, different, local NOT modified after last_merge → safe
    const safe = db.prepare(`
        SELECT e.number, e.notation, s.notation as local_notation
        FROM ext.signs e JOIN signs s USING(number)
        WHERE s.notation != '' AND e.notation != '' AND e.notation != s.notation
        AND s.modified_at <= :last_merge
    `).all({ last_merge });
    for (const r of safe) {
        updNotation.run(r.notation, r.number);
        report.push(`SIGNOTACIÓN - Signo ${r.number} (${getGloss.get(r.number)}): actualizada "${r.local_notation}" → "${r.notation}"`);
    }

    // Conflicts: both modified after last_merge
    const conflicts = db.prepare(`
        SELECT e.number, e.notation, s.notation as local_notation
        FROM ext.signs e JOIN signs s USING(number)
        WHERE s.notation != '' AND e.notation != '' AND e.notation != s.notation
        AND s.modified_at > :last_merge
    `).all({ last_merge });
    for (const r of conflicts) {
        if (overwrite) {
            updNotation.run(r.notation, r.number);
            report.push(`SIGNOTACIÓN - Signo ${r.number} (${getGloss.get(r.number)}): CONFLICTO sobreescrito "${r.local_notation}" → "${r.notation}"`);
        } else {
            report.push(`SIGNOTACIÓN - Signo ${r.number} (${getGloss.get(r.number)}): CONFLICTO mantenido local "${r.local_notation}" (externo: "${r.notation}")`);
        }
    }
}

function importComments(db, overwrite, report, getGloss) {
    const local = db.prepare("SELECT sign, content FROM attachments WHERE type='comment'").all();
    const ext   = db.prepare("SELECT sign, content FROM ext.attachments WHERE type='comment'").all();
    const localMap = new Map(local.map(r => [r.sign, '' + r.content]));

    const insDef = db.prepare(`INSERT INTO attachments(sign, id, type, content)
        VALUES (?, (SELECT COALESCE(MAX(id),-1)+1 FROM attachments WHERE sign = ?), 'comment', ?)`);
    const updComment = db.prepare(`UPDATE attachments SET content = ? WHERE sign = ? AND type = 'comment'`);

    for (const r of ext) {
        const ec = '' + r.content;
        if (!localMap.has(r.sign)) {
            insDef.run(r.sign, r.sign, r.content);
            report.push(`NOTAS - Signo ${r.sign} (${getGloss.get(r.sign)}): nota nueva importada`);
        } else if (localMap.get(r.sign) !== ec) {
            if (overwrite) {
                updComment.run(r.content, r.sign);
                report.push(`NOTAS - Signo ${r.sign} (${getGloss.get(r.sign)}): nota sobreescrita`);
            } else {
                report.push(`NOTAS - Signo ${r.sign} (${getGloss.get(r.sign)}): diferencias ignoradas (mantener local)`);
            }
        }
    }
}

function importFlags(db, overwrite, report, getGloss) {
    // Ensure all ext flag types exist locally (map by icon)
    db.exec(`INSERT OR IGNORE INTO flags(icon, name)
        SELECT e.icon, e.name FROM ext.flags e
        LEFT JOIN flags l ON l.icon = e.icon
        WHERE l.id IS NULL`);

    // Build icon→local_id map
    const flagMap = new Map(
        db.prepare(`SELECT icon, id FROM flags`).all().map(r => [r.icon, r.id])
    );

    // Ext flags as icon-sets per sign
    const extFlagRows = db.prepare(`
        SELECT sf.sign, f.icon FROM ext.signFlags sf JOIN ext.flags f ON sf.flag = f.id
    `).all();
    const extFlagsBySign = groupBy(extFlagRows, 'sign');

    const localFlagRows = db.prepare(`
        SELECT sf.sign, f.icon FROM signFlags sf JOIN flags f ON sf.flag = f.id
    `).all();
    const localFlagsBySign = groupBy(localFlagRows, 'sign');

    const addFlag = db.prepare("INSERT OR IGNORE INTO signFlags(sign, flag) VALUES (?, ?)");
    const delSignFlags = db.prepare("DELETE FROM signFlags WHERE sign = ?");

    for (const [sign, rows] of extFlagsBySign) {
        const extIcons = new Set(rows.map(r => r.icon));
        const localIcons = new Set((localFlagsBySign.get(sign) || []).map(r => r.icon));

        const toAdd = [...extIcons].filter(i => !localIcons.has(i));
        const toRemove = [...localIcons].filter(i => !extIcons.has(i));

        if (toAdd.length === 0 && toRemove.length === 0) continue;

        if (overwrite) {
            // Replace: delete all local flags, insert all ext flags
            delSignFlags.run(sign);
            for (const icon of extIcons) addFlag.run(sign, flagMap.get(icon));
            if (toAdd.length > 0 || toRemove.length > 0) {
                report.push(`FLAGS - Signo ${sign} (${getGloss.get(sign)}): flags sobreescritas`);
            }
        } else {
            // Keep local: only add new flags from ext
            for (const icon of toAdd) addFlag.run(sign, flagMap.get(icon));
            if (toAdd.length > 0) {
                report.push(`FLAGS - Signo ${sign} (${getGloss.get(sign)}): ${toAdd.length} flag(s) añadidas`);
            }
        }
    }
}

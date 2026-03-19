const { contextBridge, ipcRenderer } = require('electron');

const { getDB } = require('../common/back.js');

let db, sql = {};
const init = (async function () {
    db = await getDB();
    try {
        sql.select = db.prepare("SELECT * FROM signs WHERE number = ?");
        sql.update = db.prepare(`UPDATE signs SET
            gloss = coalesce(:gloss, gloss),
            notation = coalesce(:notation, notation),
            modified_by = :modified_by,
            modified_at = coalesce(:modified_at, datetime('now','localtime'))
            WHERE number = ?`);
        sql.getFlags = db.prepare(`SELECT flags.*,
            signFlags.sign is not null AS checked
            FROM flags LEFT JOIN signFlags
            ON flags.id = signFlags.flag AND signFlags.sign = ?;`);
        sql.flagAdd = db.prepare("INSERT OR IGNORE INTO signFlags(sign, flag) VALUES (?, ?)");
        sql.flagRemove = db.prepare("DELETE FROM signFlags WHERE sign = ? AND flag = ?");
        sql.flagCreate = db.prepare("INSERT INTO flags(icon, name) VALUES (?, ?) RETURNING id").pluck();
        sql.getNext = db.prepare("SELECT number FROM signs WHERE number > ? ORDER BY number ASC LIMIT 1").pluck();
        sql.getPrev = db.prepare("SELECT number FROM signs WHERE number < ? ORDER BY number DESC LIMIT 1").pluck();
        sql.getAttachments = db.prepare("SELECT * FROM attachments WHERE sign = ? ORDER BY id ASC");
        sql.newAttachment = db.prepare(`INSERT INTO attachments(sign, id, type, content)
            SELECT :sign, COALESCE(MAX(id),-1)+1, :type, :content FROM attachments
            WHERE sign = :sign
            `);
        sql.rmAttachment = db.prepare("DELETE FROM attachments WHERE sign = ? AND id = ?");
        sql.updAttachment = db.prepare("UPDATE attachments SET content = ? WHERE sign = ? AND id = ?");
        sql.getAttachment = db.prepare("SELECT content FROM attachments WHERE sign = ? AND id = ?").pluck();
        sql.getComment = db.prepare("SELECT * FROM attachments WHERE sign = ? AND type = 'comment' LIMIT 1");
    } catch (e) { console.error(e) };
})();

async function getSign (number) {
    return {
        ...await sql.select.get(number),
        flags: await sql.getFlags.all(number),
        attachments: await sql.getAttachments.all(number),
    };
}

contextBridge.exposeInMainWorld('back', {

    select: async number => { await init; return getSign(number); },

    update: async (number, {gloss,notation,modified_at,modified_by,flags}) => {
        await init;
        if (flags) flags.forEach(f => {
            if (f.checked) sql.flagAdd.run(number, f.id);
            else sql.flagRemove.run(number, f.id);
        });
        await sql.update.run(number, {gloss,notation,modified_at,modified_by});
        return getSign(number);
    },

    createFlag: async (number, icon, name) => {
        const flid = await sql.flagCreate.get(icon, name);
        await sql.flagAdd.run(number, flid);
        return getSign(number);
    },

    advanceSign: async (number, backwards) => {
        const next = await (backwards?sql.getPrev:sql.getNext).get(number);
        ipcRenderer.invoke('open_detail', { number: next, reuse: true });
    },

    newAttachment: async (number, type, content) => {
        await sql.newAttachment.run({ sign: number, type, content });
        return getSign(number);
    },

    rmAttachment: async (number, id) => {
        await sql.rmAttachment.run(number, id);
        return getSign(number);
    },

    updAttachment: async (number, { id, content }) => {
        await sql.updAttachment.run(content, number, id);
        return getSign(number);
    },

    setComment: async (number, content) => {
        await init;
        const existing = sql.getComment.get(number);
        if (existing) {
            sql.updAttachment.run(content, number, existing.id);
        } else {
            sql.newAttachment.run({ sign: number, type: 'comment', content });
        }
        return getSign(number);
    },

    swapAttachments: async (number, id1, id2) => {
        await init;
        const content1 = sql.getAttachment.get(number, id1);
        const content2 = sql.getAttachment.get(number, id2);
        if (content1 === undefined || content2 === undefined) return getSign(number);
        sql.updAttachment.run(content2, number, id1);
        sql.updAttachment.run(content1, number, id2);
        return getSign(number);
    },

});

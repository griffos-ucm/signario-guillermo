import { createRoot } from "react-dom/client";
import { useState, useEffect, useRef } from "react";
import marked from "marked";

import { debounce, useLocalStorage } from '../common/front.js';
import { Signotator, SignotationInput } from 'signotator';

const saveDB = debounce(600);
const msgDB = debounce(3500);
const saveMSG = {
    0: "", // Pristine
    1: "", // Careful! NBSP (\u00A0)
    2: "Cambios sin guardar",
    3: "Todo guardado 👍"
};
let original_info = null;

const urlParams = (new URL(document.location)).searchParams;
const number = urlParams.get('number');
const video_dir = urlParams.get('video_dir');
const user_name = urlParams.get('user_name') || 'anon';

createRoot(document.getElementById("appRoot")).render(<DetailFront />);

function DetailFront () {
    const [ info, setInfo ] = useState(null);
    const [ saveStatus, setSS ] = useState(0);
    useEffect(() => {
        (async () => {
            const got_info = await back.select(number);
            setInfo(got_info);
            original_info = got_info;
        })();

        const advance = e => {
            if (e.ctrlKey && e.key=="Enter") {
                back.advanceSign(number, false);
            } else if (e.ctrlKey && e.key=="Backspace") {
                back.advanceSign(number, true);
            }
        };
        addEventListener("keyup", advance);
        return () => removeEventListener("keyup", advance);
    }, []);
    const updInfo = (upd, keep_name) => {
        if (!keep_name) upd.modified_by = user_name;
        setInfo({...info, ...upd});
        setSS(2);
        msgDB.clear();
        saveDB.run(async () => {
            setInfo(await back.update(number, upd));
            setSS(3);
            msgDB.run(() => setSS(1));
        });
    };
    const createFlag = async (icon, name) => {
        setInfo(await back.createFlag(number, icon, name));
    };
    const newDefinition = async () => {
        setInfo(await back.newAttachment(number, 'definition', ''));
    };
    const rmDefinition = async id => {
        setInfo(await back.rmAttachment(number, id));
    };
    const updDefinition = async definition => {
        const attachments = info.attachments.slice();
        attachments[attachments.findIndex(el => el.id == definition.id)] = definition;
        setInfo({
            ...info, attachments,
            modified_by: user_name,
        });
        setSS(2);
        msgDB.clear();
        saveDB.run(async () => {
            setInfo(await back.updAttachment(number, definition));
            setSS(3);
            msgDB.run(() => setSS(1));
        });
    };

    const [ tab, setTab ] = useLocalStorage("detail_tab", "info");
    function NavButton ({ name, code }) {
        const cur = code == tab;
        return <button className="p-2"
            onClick={cur?null:() => setTab(code)}
            disabled={cur}>{name}</button>;
    }

    let theTab;
    if (tab == "info" && info != null) {
        theTab = <Info update={updInfo} saveStatus={saveStatus} createFlag={createFlag}
            reset={() => updInfo(original_info, true)} {...info} />;
    } else if (tab == "signot") {
        theTab = <ParamTab update={updInfo} {...info} />;
    } else {
        theTab = <LexicTab newDefinition={newDefinition} rmDefinition={rmDefinition}
            updDefinition={updDefinition} gloss={info?.gloss||''}
            definitions={info?.attachments?.filter(a => a.type == 'definition')||[]} />;
    }

    return <div className="grid grid-flow-dense auto-cols-fr grid-rows-[auto,auto,auto,1fr] md:grid-rows-[auto,auto,1fr]">
        <h1 className="p-2">
            <span className="font-bold">{info?.gloss}</span>
            <span className="ml-3 italic text-sm text-gray-800">{saveStatus>1?saveMSG[saveStatus]:" "}</span>
        </h1>
        <div className="md:mt-3 md:row-span-3 md:col-start-2 bg-gray-300"><VideoPlay /></div>
        <nav className="mt-3 md:mt-0 space-x-1">
            <NavButton name="Metadatos" code="info" />
            <NavButton name="Signotación" code="signot" />
            <NavButton name="Acepciones" code="lexic" />
        </nav>
        <div className="p-2">{theTab}</div>
    </div>;
}

function VideoPlay () {
    const video_src = `${video_dir}/${number.substring(0,3)}/${number.substring(3)}.mp4`;
    const vid = useRef(null);
    useEffect(() => {
        const replay = e => {
            const v = vid.current;
            if (e.key == 'Enter') {
                if (v.paused) v.play();
                else v.pause();
                e.preventDefault();
            }
        };
        vid.current.addEventListener('keyup', replay);
        addEventListener('keyup', replay);
        return () => removeEventListener('keyup', replay);
    }, []);
    return <video ref={vid} className="cursor-pointer" muted autoPlay controls >
        <source src={video_src} />
    </video>;
}

function Info ({ gloss, update, reset, modified_by, modified_at, saveStatus, flags, createFlag }) {
    const [flOpen,setFlOpen] = useState(false);
    const toggleFlag = id => {
        const nufls = flags.slice();
        const fl = nufls.findIndex(f => f.id == id);
        const old_flag = flags[fl];
        nufls[fl] = { ...old_flag, checked: !old_flag.checked };
        update({ flags: nufls });
    };
    return <ul className="space-y-1">
        <li>Número: {number}<span className="mr-2" />
            {flags.filter(f => f.checked).map(f => <FlagIcon key={f.id} {...f}
                onClick={() => toggleFlag(f.id)} />)}
        </li>
        <li className="text-lg border-t border-primary-600 pt-1">Glosa:</li>
        <li className="text-lg border-b border-primary-600 pb-2">
            <input className="p-1 w-full" type="text" value={gloss}
                onChange={e => update({gloss: e.target.value})} />
        </li>
        <li>Entrada por <i>{modified_by}</i> el <i>{modified_at}</i></li>
        <li><button className="pill" disabled={saveStatus==0} onClick={reset}>Revertir todos los cambios</button></li>
        <li className="border-t border-primary-600 mt-1 pt-1">
            <button className="pill" onClick={() => setFlOpen(!flOpen)}>Editar banderas</button>
        </li>
        {flOpen?<FlagsDiv flags={flags} toggleFlag={toggleFlag} createFlag={createFlag} />:null}
    </ul>;
}

function ParamTab ({ update, notation }) {
    const notationInput = useRef();
    useEffect(() => { notationInput.current?.focus(); }, []);
    const updateNotation = x => update({notation: x});
    return <div className="text-lg pt-1 space-y-3">
        <SignotationInput inputRef={notationInput} value={notation} updateVal={updateNotation} />
        <Signotator inputRef={notationInput} updateVal={updateNotation} />
    </div>;
}

function FlagsDiv ({ flags, toggleFlag, createFlag }) {
    const [emoji,setEmoji] = useState("");
    const [desc,setDesc] = useState("");
    const fixEmoji = e => {
        try {
            const char = String.fromCodePoint(e.target.value?.codePointAt(0));
            setEmoji(char?(char+"\uFE0F"):"");
        } catch { setEmoji(""); }
    }
    const create = e => {
        createFlag(emoji, desc);
        setEmoji(""); setDesc("");
        e.preventDefault();
    };
    return <>
        <li className="italic text-sm tex-grey-800">Haz click en las banderas activas para quitarlas, click aquí para añadirlas. El emoji lo puedes buscar en emojipedia.com.</li>
        <li>{flags.filter(f => !f.checked).map(f => <FlagIcon {...f} key={f.id}
            onClick={() => toggleFlag(f.id)} />)}</li>
        <li><form onSubmit={create}>
            <input name="icon" type="text" className="w-[2em]"
                onChange={fixEmoji} value={emoji} />
            <input name="desc" type="text" placeholder="descripción"
                onChange={e => setDesc(e.target.value)} value={desc} />
            <button disabled={!emoji || !desc} className="!py-0 ml-1 pill">Crear</button>
        </form></li>
    </>;
}

function FlagIcon ({ icon, name, onClick }) {
    const className = "font-[none]"+(onClick==null?" cursor-default":"");
    return <button className={className} title={name}
        onClick={onClick}>{icon}</button>;
}

function LexicTab ({ newDefinition, rmDefinition, updDefinition, definitions, gloss }) {
    const butstyle = "border font-bold rounded border-secondary-600 text-secondary-700 hover:bg-secondary-300 bg-secondary-200 py-1 px-2";
    const defstyle = "border border-secondary-600 bg-gray-100 p-2 rounded cursor-pointer flex-1 mr-2";
    const [editing, setEditing] = useState(-1);
    const [curText, setCurText] = useState("");
    const startEdit = i => {
        setCurText(definitions[i].content);
        setEditing(i);
    };
    const finish = e => {
        if (editing<0) return;
        updDefinition({ ...definitions[editing], content: curText });
        setEditing(null);
        setCurText("");
        e.preventDefault();
        e.stopPropagation();
    };
    return <>
        {definitions.length==0?<p className="italic m-1 mb-2">Si no hay acepciones, se usará la glosa como única definición.</p>:null}
        {definitions.map((d, i) => <div key={i} className="flex mb-3">
            {editing==i?
                <textarea autoFocus className={defstyle} value={curText}
                    onKeyDown={e => { if (e.key=="Enter") finish(e); }}
                    onBlur={finish} onChange={e => setCurText(e.target.value)}
                />:
                <div className={defstyle+" prose prose-zinc prose-amber leading-snug"} onClick={() => startEdit(i)}
                    dangerouslySetInnerHTML={{__html: marked.parse(d.content)}}
                />}
            <button className={butstyle} onClick={() => { rmDefinition(d.id); setEditing(-1); }}>-</button>
        </div>)}
        <button className={butstyle} onClick={() => {
            newDefinition();
            setEditing(definitions.length);
            if (definitions.length==0) setCurText(gloss);
        }}>+</button>
    </>;
}

import { createRoot } from "react-dom/client";
import { useState, useEffect, useRef } from "react";

import { useLocalStorage } from '../common/front.jsx';
import { Signotation } from 'signotator';

const urlParams = (new URL(document.location)).searchParams;
const user_name = urlParams.get('user_name') || 'anon';

const PAGE_SIZE = 50;

function useTable () {

    const [ isLoading, setIsLoading ] = useState(true);
    const [ query, setQuery ] = useState(null);
    const [ page, setPage ] = useLocalStorage("table_page", 0);
    const [ data, setData ] = useState({
        rows: [],
        numPages: 1,
        totalCount: 0,
        finished: 0
    });

    useEffect(() => {
        const load = async () => {
            try {
                const nudata = await back.select(query);
                nudata.numPages = Math.floor(nudata.rows.length / PAGE_SIZE)
                    +((nudata.rows.length % PAGE_SIZE)?1:0);
                if (page > nudata.numPages) setPage(nudata.numPages-1);
                setData(nudata);
            } catch (e) { console.error(e); }
            setIsLoading(false);
        }
        load();
        const listener = window.addEventListener("focus", load);
        return () => window.removeEventListener("focus", load);
    }, [query]);

    return { ...data,
        rows: data.rows.slice(page*PAGE_SIZE, (page+1)*PAGE_SIZE),
        page, goto: setPage,
        search: setQuery,
    };
}

const MAX_TABS = 15;
function App () {
    const table = useTable();
    return <div className="flex flex-col">
        <Header table={table} />
        <nav>
            <span className="h-8 py-1 mr-1">Página:</span>
            {Array(table.numPages).fill().map((_, i) => {
                const cur = i==table.page;
                let dist = Math.abs(i-table.page);
                if (i==0 || i==table.numPages-1) dist=0;
                else if (dist>MAX_TABS) dist=MAX_TABS;
                dist = dist/(MAX_TABS*1.1);
                dist = 100 * (dist*dist);
                return <span key={i} className={`${dist<3?"min-w-[2em] basis-auto":"min-w-[3px] basis-0"} max-w-[4em] shrink ${dist<MAX_TABS?"px-[2px]":""}`}
                    style={{flexGrow: 100-dist, transition:"flex-grow 200ms"}}>
                    <button className="w-full h-8 break-all overflow-hidden" disabled={cur}
                        onClick={cur?()=>{}:() => table.goto(i)}>{` ${i+1} `}</button>
                </span>;
            })}
        </nav>
        <div className="overflow-y-auto">
            <SignTable table={table} />
        </div>
    </div>;
}

function SignTable ({ table }) {
    return <table className="SignTable">
        <thead>
            <tr>
                <th></th>
                <th>Glosa</th>
                <th>Signotación</th>
                <th></th>
            </tr>
        </thead>
        <tbody>
            {table.rows.length>0?
                table.rows.map(r => <tr className="group" key={r.number}>
                    <td className="flex">
                        <span className="text-secondary-800/80 group-hover:text-primary-600">{r.number}</span>
                        <span className="ml-auto font-[none]">{r.flag_icons}</span>
                    </td>
                    <td className="truncate max-w-[40vw]">{r.gloss}</td>
                    <td className="truncate max-w-[40vw]"><Signotation sn={r.notation} /></td>
                    <td className="text-secondary-800 whitespace-nowrap">
                        <button className="align-middle hover:text-primary-700 mr-1" onClick={() => back.openDetail(r.number, true)}><EditButton /></button>
                        <button className="align-middle hover:text-primary-700" onClick={() => back.openDetail(r.number, false)}><PopupButton /></button>
                    </td>
                </tr>):
                <tr>
                    <td colSpan="4" className="text-secondary-800 italic px-4 py-1">{table.isLoading?"Cargando...":"No hay resultados"}</td>
                </tr>
            }
        </tbody>
    </table>;
}

function Header ({ table }) {
    const [isEditingName, setEditingName] = useState(false);
    const startEditName = e => {
        setEditingName(true);
        const list = () => {
            setEditingName(false);
            document.removeEventListener('click', list);
        };
        document.addEventListener('click', list);
        e.stopPropagation();
    };
    const changeName = e => {
        const name = e.target.querySelector('input[type="text"]').value.trim();
        if (name && name!=user_name) { back.setUserName(name); }
        setEditingName(false);
        e.preventDefault();
    };
    return <header className="grid grid-cols-[auto,auto,1fr] py-3 px-2 gap-1">
        <h1 className="text-primary-800 text-xl font-bold row-start-1 col-start-1 col-end-3">Signario - Guillermo</h1>
        <div className="col-start-3 row-start-1 row-end-4"></div>
        <ProgressReport title="Signotación" current={table.finished} total={table.totalCount} />
        <span className="mr-1">Usuario:</span>
        {isEditingName ?
            <form onSubmit={changeName} onClick={e => e.stopPropagation()}><input autoFocus type="text" /></form>:
            <span className="ml-1">{user_name} <button className="align-middle hover:text-primary-700"
                onClick={startEditName}><EditButton />
            </button></span>
        }
        <TableFilter search={table.search} />
    </header>;
}

function ProgressReport ({ title, current, total }) {
    const angle = total>0?current*2*Math.PI/total:0;
    return <>
        <div className="row-start-1 row-end-4 flex flex-col items-center justify-center">
            <span>{title}:</span>
            <span>{current}</span>
            <span className="px-1 border-t border-gray-900">{total}</span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" className="h-full row-start-1 row-end-4 mr-4">
            <circle cx="10" cy="10" r="7" className="stroke-gray-400" strokeWidth="5" fill="none" />
            {total==0||current<total?
                <path d={`M 10,3 A 7 7 0 ${angle>Math.PI?1:0} 1 ${10+7*Math.sin(angle)} ${10-7*Math.cos(angle)}`}
                    className="stroke-secondary-200" strokeWidth="3" fill="none" />:
                <circle cx="10" cy="10" r="7" className="stroke-primary-300" strokeWidth="3" fill="none" />
            }
        </svg>
    </>;
}

const PopupButton = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
  <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
  <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
</svg>;

const EditButton = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
  <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
  <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
</svg>;

function TableFilter ({ search }) {
    const form = useRef();
    const [flags, setFlags] = useState([]);
    useEffect(() => {
        back.getFlags().then(setFlags);
    }, []);
    const [flagSelection, setFlagSelection] = useState([]);
    const toggleFlag = i => {
        const fs = flagSelection.slice();
        fs[i] = !flagSelection[i];
        setFlagSelection(fs);
    };
    const submit = () => {
        const f = form.current;
        const query = {
            gloss: f["gloss"].value.trim(),
            notation: f["notation"].value.trim(),
            flags: flags.filter(fl => f[fl.name].checked).map(fl => fl.id),
        }
        search(query);
    };
    return <>
        <span className="mr-1">Filtro:</span>
        <form ref={form} onChange={submit} >
            <input name="gloss" type="text" placeholder="glosa" />
            <input name="notation" type="text" placeholder="signotación" className="ml-1" />
            {flags.map(({icon,name}, i) => <label key={i} title={name} className="ml-2">
                <input name={name} type="checkbox" checked={flagSelection[i]||false}
                    onChange={() => toggleFlag(i)} />
                <span className="ml-1 font-[none]">{icon}</span>
            </label>)}
        </form>
    </>;
}

createRoot(document.getElementById("appRoot")).render(<App />);

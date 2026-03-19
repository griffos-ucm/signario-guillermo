import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";

const extName = back.getExtName();

createRoot(document.getElementById("appRoot")).render(<ImportFront />);

function ImportFront () {
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);

    const [cats, setCats] = useState({
        definitions: true,
        notation: false,
        comments: false,
        flags: false,
    });
    const [strategy, setStrategy] = useState('overwrite');
    const [generateReport, setGenerateReport] = useState(false);

    useEffect(() => {
        back.analyze()
            .then(setAnalysis)
            .catch(e => setError('Error al analizar: ' + e.message));
    }, []);

    const toggleCat = key => setCats({ ...cats, [key]: !cats[key] });
    const anySelected = Object.values(cats).some(Boolean);

    const doImport = async () => {
        setImporting(true);
        try {
            const res = await back.execute({ categories: cats, strategy, generateReport });
            setResult(res);
        } catch (e) {
            setError('Error al importar: ' + e.message);
        }
        setImporting(false);
    };

    if (error) return <div className="p-4">
        <h1 className="font-bold text-lg text-red-700 mb-2">Error</h1>
        <p>{error}</p>
    </div>;

    if (result) return <div className="p-4 space-y-3">
        <h1 className="font-bold text-lg text-green-700">Importación completada</h1>
        {result.reportPath && <p className="text-sm">Informe guardado en: <code className="bg-gray-100 px-1">{result.reportPath}</code></p>}
        <p className="text-sm text-gray-600">Puedes cerrar esta ventana.</p>
    </div>;

    if (!analysis) return <div className="p-4">
        <p className="text-gray-600">Analizando base de datos...</p>
    </div>;

    const { definitions: d, notation: n, comments: c, flags: f } = analysis;
    const hasConflicts = n.conflicts > 0;

    return <div className="p-4 space-y-4">
        <div>
            <h1 className="font-bold text-lg">Importación parcial</h1>
            <p className="text-sm text-gray-600">Archivo: {extName}</p>
        </div>

        <fieldset className="space-y-3" disabled={importing}>
            <Category label="Acepciones" checked={cats.definitions} onChange={() => toggleCat('definitions')}
                total={d.added + d.modified}>
                {d.added > 0 && <li>{d.added} signos con acepciones nuevas</li>}
                {d.modified > 0 && <li>{d.modified} signos con acepciones modificadas</li>}
            </Category>

            <Category label="Signotación" checked={cats.notation} onChange={() => toggleCat('notation')}
                total={n.added + n.modified + n.conflicts}>
                {n.added > 0 && <li>{n.added} signos con notación nueva</li>}
                {n.modified > 0 && <li>{n.modified} signos con notación actualizada</li>}
                {n.conflicts > 0 && <li className="text-amber-700 font-medium">{n.conflicts} conflictos</li>}
            </Category>

            <Category label="Notas internas" checked={cats.comments} onChange={() => toggleCat('comments')}
                total={c.added + c.modified}>
                {c.added > 0 && <li>{c.added} signos con notas nuevas</li>}
                {c.modified > 0 && <li>{c.modified} signos con notas modificadas</li>}
            </Category>

            <Category label="Banderas" checked={cats.flags} onChange={() => toggleCat('flags')}
                total={f.changed}>
                {f.changed > 0 && <li>{f.changed} signos con banderas diferentes</li>}
            </Category>
        </fieldset>

        <fieldset className="border border-gray-400 rounded p-3 space-y-1" disabled={importing}>
            <legend className="text-sm font-medium px-1">Cuando hay diferencias</legend>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="strategy" value="overwrite"
                    checked={strategy === 'overwrite'} onChange={() => setStrategy('overwrite')} />
                Sobreescribir con datos externos
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="strategy" value="keep_local"
                    checked={strategy === 'keep_local'} onChange={() => setStrategy('keep_local')} />
                Mantener datos locales (solo importar datos nuevos)
            </label>
        </fieldset>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={generateReport}
                onChange={() => setGenerateReport(!generateReport)} disabled={importing} />
            Generar informe (GUILLERMO_CONFLICTOS.txt)
        </label>

        <div className="flex gap-2 justify-end pt-2 border-t border-gray-300">
            <button className="pill" onClick={() => window.close()} disabled={importing}>Cancelar</button>
            <button className="pill" disabled={!anySelected || importing} onClick={doImport}>
                {importing ? 'Importando...' : 'Importar selección'}
            </button>
        </div>
    </div>;
}

function Category ({ label, checked, onChange, total, children }) {
    const hasChanges = total > 0;
    return <div className={`border rounded p-2 ${checked ? 'border-primary-500 bg-primary-50' : 'border-gray-300'}`}>
        <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={checked} onChange={onChange} disabled={!hasChanges} />
            <span className={`font-medium ${!hasChanges ? 'text-gray-400' : ''}`}>{label}</span>
            {!hasChanges && <span className="text-xs text-gray-400 italic">sin cambios</span>}
        </label>
        {hasChanges && <ul className="text-sm text-gray-700 ml-6 mt-1 list-disc">
            {children}
        </ul>}
    </div>;
}

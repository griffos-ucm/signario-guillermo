import { createRoot } from "react-dom/client";
import { useState } from "react";

function App () {
    const [ data, setData ] = useState({ gloss: true, flags: true, attachments: true });
    const [ entries, setEntries ] = useState('all');
    const [ working, setWorking ] = useState(false);

    const toggleData = key => setData(d => ({ ...d, [key]: !d[key] }));

    const anyDataSelected = data.gloss || data.flags || data.attachments;

    const handleConfirm = async () => {
        setWorking(true);
        await back.confirmImport({ data, entries });
    };

    const handleCancel = async () => {
        await back.cancelImport();
    };

    return <div className="p-6 flex flex-col gap-5">
        <h1 className="text-lg font-semibold">Importar parcialmente</h1>

        <div className="flex flex-col gap-1">
            <h2 className="font-medium text-sm text-gray-600 uppercase tracking-wide mb-1">
                Qué datos importar
            </h2>
            {[
                ['gloss', 'Señas (gloss y notación)'],
                ['flags', 'Etiquetas'],
                ['attachments', 'Archivos adjuntos'],
            ].map(([key, label]) =>
                <label key={key} className="flex gap-2 items-center cursor-pointer select-none">
                    <input type="checkbox" checked={data[key]}
                        onChange={() => toggleData(key)} />
                    {label}
                </label>
            )}
        </div>

        <div className="flex flex-col gap-1">
            <h2 className="font-medium text-sm text-gray-600 uppercase tracking-wide mb-1">
                Qué entradas importar
            </h2>
            {[
                ['all', 'Todas las entradas de la BD externa'],
                ['newer_in_external', 'Solo entradas modificadas en la BD externa (desde la última mezcla)'],
                ['not_in_ours', 'Solo entradas nuevas (no presentes en nuestra BD)'],
            ].map(([value, label]) =>
                <label key={value} className="flex gap-2 items-center cursor-pointer select-none">
                    <input type="radio" name="entries" value={value}
                        checked={entries === value}
                        onChange={() => setEntries(value)} />
                    {label}
                </label>
            )}
        </div>

        <div className="flex gap-3 justify-end pt-1">
            <button onClick={handleCancel} disabled={working}
                className="pill px-4 py-1.5">
                Cancelar
            </button>
            <button onClick={handleConfirm} disabled={working || !anyDataSelected}
                className="pill px-4 py-1.5 !bg-primary-400 !border-primary-600 !text-primary-900 hover:!bg-primary-300">
                {working ? 'Importando…' : 'Importar'}
            </button>
        </div>
    </div>;
}

createRoot(document.getElementById('appRoot')).render(<App />);

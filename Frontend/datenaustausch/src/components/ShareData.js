// TODO: Datei teilen Logik
export default function ShareData() {
  return (
    <div className="card">
      <div className="card-header">
        <h2>Datei teilen</h2>
      </div>
      <div className="card-body">
        <p className="description">
          Verschlüssele eine Datei und teile sie mit einem registrierten Nutzer.
        </p>
        <button className="btn btn-primary" disabled>
         Verschlüsseln & Teilen
        </button>
      </div>
    </div>
  );
}

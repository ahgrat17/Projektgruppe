//TODO: Empfangen und Entschlüsseln Logik
export default function ReceiveData() {
  return (
    <div className="card">
      <div className="card-header">
        <h2>Meine Datenpakete</h2>
      </div>
      <div className="card-body">
        <p className="description">
          Zeige alle Datenpakete die für deine Adresse freigegeben wurden.
        </p>
        <button className="btn btn-primary" disabled>
          Datenpakete laden 
        </button>
      </div>
    </div>
  );
}

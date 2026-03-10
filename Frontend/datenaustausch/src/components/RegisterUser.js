// TODO: Registrierungslogik
export default function RegisterUser() {
  return (
    <div className="card">
      <div className="card-header">
        <h2>Registrierung</h2>
      </div>
      <div className="card-body">
        <p className="description">
          Generiere ein RSA Schlüsselpaar
        </p>
        <button className="btn btn-primary" disabled>
          Registrieren
        </button>
      </div>
    </div>
  );
}

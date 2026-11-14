// =====================================================================
// Dueño: P3 (Vista)
// Tarjeta de un tipo de vegetación / combustible (eucalipto, pino, pajonal, kewiña...).
// =====================================================================

export default function FuelProfileCard(props) {
  const fuel = props.fuel;
  const compact = props.compact === true;
  if (!fuel) {
    return null;
  }

  return (
    <article
      style={{
        borderLeft: '6px solid ' + (fuel.color || '#888'),
        background: '#fafafa',
        padding: compact ? '6px 8px' : '10px 12px',
        marginBottom: 8,
        borderRadius: 4,
        fontSize: compact ? 12 : 13
      }}
    >
      <div style={{ fontWeight: 700 }}>{fuel.nombre}</div>
      {!compact && fuel.especies && <div style={{ color: '#555', fontStyle: 'italic' }}>{fuel.especies}</div>}
      <table style={{ borderCollapse: 'collapse', marginTop: 4 }}>
        <tbody>
          <tr>
            <td style={{ paddingRight: 8 }}>Inflamabilidad</td>
            <td><b>{fuel.inflamabilidad}</b></td>
          </tr>
          <tr>
            <td style={{ paddingRight: 8 }}>Propagación</td>
            <td><b>{fuel.propagacion}</b></td>
          </tr>
          {!compact && (
            <tr>
              <td style={{ paddingRight: 8 }}>Recuperación</td>
              <td>{fuel.recuperacion}</td>
            </tr>
          )}
        </tbody>
      </table>
      <p style={{ margin: '4px 0 0' }}>{fuel.explicacion}</p>
      {!compact && fuel.alerta_satelital && (
        <p style={{ margin: '4px 0 0', color: '#444' }}>
          <b>Satélite:</b> {fuel.alerta_satelital}
        </p>
      )}
    </article>
  );
}

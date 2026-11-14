// =====================================================================
// Dueño: P3 (Vista)
// Banner de página: imagen de Cochabamba con movimiento lento (Ken Burns), degradado para leer el título
// y una banda de textil andino como divisor. Las imágenes son ilustraciones generadas con IA y se rotulan.
// =====================================================================

export default function Banner(props) {
  const { image, children, label } = props;
  return (
    <header className="banner">
      <div className="banner__img" style={{ backgroundImage: 'url(' + image + '), linear-gradient(135deg, #1f3d2b, #0e1a14)' }} role="img" aria-label={label} />
      <div className="banner__shade" aria-hidden="true" />
      <div className="banner__content">{children}</div>
      <div className="banner__textile" aria-hidden="true" />
    </header>
  );
}

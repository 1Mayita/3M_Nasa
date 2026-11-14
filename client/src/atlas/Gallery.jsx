// =====================================================================
// Dueño: P3 (Vista)
// Galería "Cochabamba, de un vistazo": tarjetas con imagen que se desplazan solas como una cinta,
// con pausa al pasar el cursor o con el foco. Las imágenes son ilustraciones generadas con IA (se rotulan).
// =====================================================================

const BASE = import.meta.env.BASE_URL || '/';

export const GALLERY_ITEMS = [
  { image: 'plaza_catedral', caption: 'capPlaza' },
  { image: 'mercado_cancha', caption: 'capMercado' },
  { image: 'laguna_alalay', caption: 'capAlalay' },
  { image: 'tunari_cumbre', caption: 'capCumbre' },
  { image: 'chapare_selva', caption: 'capChapare' },
  { image: 'valle_alto', caption: 'capValleAlto' },
  { image: 'ciudad_noche', caption: 'capNoche' },
  { image: 'palacio_portales', caption: 'capPortales' },
  { image: 'bomberos_forestales', caption: 'capBomberos' }
];

export default function Gallery(props) {
  const { t } = props;
  // la lista se duplica para que el bucle sea continuo sin saltos
  const loop = GALLERY_ITEMS.concat(GALLERY_ITEMS);
  return (
    <div className="gallery" role="list" aria-label={t('galleryTitle')}>
      <div className="gallery__track">
        {loop.map(function card(item, i) {
          const isCopy = i >= GALLERY_ITEMS.length;
          return (
            <figure className="gallery__card" role={isCopy ? 'presentation' : 'listitem'} aria-hidden={isCopy ? 'true' : undefined} key={i}>
              <img
                src={BASE + 'img/' + item.image + '.webp'}
                alt={isCopy ? '' : t('aiPrefix') + t(item.caption)}
                loading="lazy"
                decoding="async"
                width="640"
                height="360"
              />
              <figcaption>{t(item.caption)}</figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

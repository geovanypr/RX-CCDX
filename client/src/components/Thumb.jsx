import React from 'react';
import { thumbUrl, authenticatedFileUrl } from '../config';

/**
 * Miniatura liviana (?thumb=1, ~15-40 KB) con doble red de seguridad para
 * redes móviles inestables:
 *  1. Si el thumb falla, reintenta una vez con la imagen completa.
 *  2. Si ambas fallan, se oculta para no dejar un icono roto.
 * El visor PACS, el lightbox y las descargas usan la imagen completa directo.
 */
const Thumb = ({ url, token, alt = '', className, style, onClick }) => {
  // Sin url no hay nada que pedir: no renderizar (antes reventaba en .includes).
  if (!url) return null;
  return (
  <img
    src={thumbUrl(url, token)}
    alt={alt}
    loading="lazy"
    decoding="async"
    draggable={false}
    className={className}
    style={style}
    onClick={onClick}
    onError={(e) => {
      const el = e.currentTarget;
      if (!el.dataset.full) {
        el.dataset.full = '1';
        el.src = authenticatedFileUrl(url, token);
      } else {
        el.style.display = 'none';
      }
    }}
  />
  );
};

export default Thumb;

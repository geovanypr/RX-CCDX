import React from 'react';
import Icon from './Icons';

/** Evita una pantalla en blanco ante un error inesperado de la interfaz. */
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('[RX CCDX] Error de interfaz:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="loading-screen" style={{ flexDirection: 'column', gap: 14, textAlign: 'center', padding: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="warning" size={28} color="#dc2626" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 19 }}>No se pudo cargar esta pantalla</h2>
          <p style={{ marginTop: 7, color: 'var(--color-text-muted)' }}>Tus datos no se han modificado. Actualiza para continuar.</p>
        </div>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          <Icon name="rotate" size={15} color="#fff" /> Recargar aplicación
        </button>
      </div>
    );
  }
}

export default AppErrorBoundary;

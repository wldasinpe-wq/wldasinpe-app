# Changelog - WLD a SINPE

## [Unreleased] - UX Improvements

### Added
- **Landing Page (Pantalla 1)**: 
  - Branding "WLD a SINPE" con logo y descripción
  - 3 features destacadas (rápido, mejor tasa, confiable)
  - Diseño profesional y moderno
  
- **Dashboard (Pantalla 2)**:
  - Hero section con call-to-action clara
  - Display de tasas de cambio en tiempo real
  - Botón prominente "Retirar WLD"
  - Información de fees y mínimos
  
- **Withdraw Page (Pantalla 3)**:
  - Display de balance disponible con equivalencias
  - Input de cantidad con botón "MAX"
  - Conversiones en tiempo real (WLD → USD → CRC)
  - Cálculo automático de fees y monto neto
  - Input de teléfono SINPE con validación
  - Información clara de comisiones
  - Avisos de seguridad

### Technical Improvements
- Constantes centralizadas para tasas de cambio (`src/constants/exchange.ts`)
- Helpers para formateo de monedas (WLD, USD, CRC)
- Función de cálculo de conversión reutilizable
- Validación mejorada de números telefónicos costarricenses
- Diseño responsive con Tailwind CSS
- Componentes reutilizables y modulares

### Constants & Placeholders
- WLD to USD: $0.40
- USD to CRC: ₡495
- Flat fee: $1.00 (₡495)
- Minimum withdrawal: 0.1 WLD

### TODO
- [ ] Integrar API real de tasas de cambio
- [ ] Obtener balance real del wallet del usuario
- [ ] Actualizar fees según estructura real de Ridivi
- [ ] Agregar historial de transacciones
- [ ] Implementar notificaciones de estado
- [ ] Agregar soporte para múltiples monedas

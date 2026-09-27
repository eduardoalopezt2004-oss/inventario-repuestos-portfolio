import { useEffect, useRef } from 'react';

// Una pistola de código de barras/QR conectada por USB o Bluetooth se
// comporta ante el navegador como un teclado: "escribe" cada carácter del
// código a máxima velocidad y termina con Enter. Este hook detecta ese
// patrón (varios caracteres seguidos, con muy poco tiempo entre cada uno,
// terminando en Enter) en CUALQUIER parte de la app — sin necesidad de que
// haya un campo de texto enfocado — y llama a onScan(codigo) cuando lo
// reconoce.
//
// No interfiere con el tecleo normal:
//  - Si el foco está en un input/textarea/select/elemento editable, este
//    hook no hace nada: se deja que ese campo maneje la tecla como siempre
//    (por ejemplo, el autocompletado por código de Categories.js).
//  - Si no hay nada enfocado (el usuario simplemente está viendo una
//    pantalla) y las teclas llegan muy rápido, se asume que es la pistola.
//  - Si las teclas llegan lento (una persona tecleando "a mano" sin querer
//    un campo enfocado), el buffer se reinicia y nunca dispara onScan.
const GAP_RESET_MS = 60;   // más de esto entre teclas = no es la pistola, se reinicia el buffer
const MIN_LARGO_CODIGO = 4; // menos que esto no se considera un código válido

// Clase temporal en <body>: la usa un modal que ya maneja sus propios
// escaneos (el lector con cámara, el formulario de producto) para avisar
// "ya me encargo yo de este escaneo" y así el popup global no se abra
// encima. Solo el escáner GLOBAL (el que no es "dueño" de ningún modal de
// escaneo) respeta esta pausa — ver ignorarPausaGlobal más abajo.
const PAUSE_CLASS = 'scanner-gun-paused';

function elementoEsEditable(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useHardwareScanner(onScan, { enabled = true, ignorarPausaGlobal = false } = {}) {
  const bufferRef = useRef('');
  const ultimoTiempoRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return undefined;

    const handleKeyDown = (e) => {
      // Si el usuario está escribiendo en un campo normal, no interferir.
      if (elementoEsEditable(document.activeElement)) return;
      // El popup global se calla si otro modal (cámara, formulario de
      // producto) ya está manejando el escaneo por su cuenta.
      if (!ignorarPausaGlobal && document.body.classList.contains(PAUSE_CLASS)) return;
      // Ignorar combinaciones con teclas modificadoras (atajos de teclado).
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const ahora = Date.now();
      const gap = ahora - ultimoTiempoRef.current;
      ultimoTiempoRef.current = ahora;

      if (e.key === 'Enter') {
        const codigo = bufferRef.current;
        bufferRef.current = '';
        if (codigo.length >= MIN_LARGO_CODIGO) {
          // Es un escaneo real: bloquear el Enter aquí mismo para que el
          // navegador no lo trate como "enviar formulario" si, por la
          // reacción al escaneo, el foco salta a un campo dentro de un
          // <form> (por ejemplo el campo Código con autoFocus del modal
          // que se abre al reconocer el producto).
          e.preventDefault();
          e.stopPropagation();
          onScanRef.current(codigo);
        }
        return;
      }

      // Solo caracteres imprimibles de un solo dígito/letra/símbolo.
      if (e.key.length !== 1) return;

      if (gap > GAP_RESET_MS) {
        // Tecleo lento: empieza un buffer nuevo (probablemente no es la pistola).
        bufferRef.current = e.key;
      } else {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, ignorarPausaGlobal]);
}

// Para usar dentro de un modal que ya maneja sus propios escaneos (cámara,
// formulario con campo Código): mientras `activo` sea true, el popup
// global de la pistola no se abrirá encima de ese modal.
export function useSuspendGlobalScanner(activo = true) {
  useEffect(() => {
    if (!activo) return undefined;
    document.body.classList.add(PAUSE_CLASS);
    return () => document.body.classList.remove(PAUSE_CLASS);
  }, [activo]);
}

export default useHardwareScanner;

import { useRef, useState } from 'react'

const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files')

// Convierte un elemento en zona para soltar imágenes arrastradas desde el escritorio.
// Devuelve `dragging` (para resaltar la zona) y los handlers a esparcir en el elemento.
export function useImageDrop(onFiles, enabled = true) {
  const [dragging, setDragging] = useState(false)
  // dragenter/dragleave se disparan también al pasar sobre los hijos: se cuenta la profundidad.
  const depth = useRef(0)

  if (!enabled) return { dragging: false, dropProps: {} }

  const reset = () => {
    depth.current = 0
    setDragging(false)
  }

  return {
    dragging,
    dropProps: {
      onDragEnter: (e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        depth.current += 1
        setDragging(true)
      },
      onDragOver: (e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      },
      onDragLeave: (e) => {
        if (!hasFiles(e)) return
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setDragging(false)
      },
      onDrop: (e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        e.stopPropagation()
        reset()
        const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'))
        if (files.length) onFiles(files)
      },
    },
  }
}

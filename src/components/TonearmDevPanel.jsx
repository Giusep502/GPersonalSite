import { useState } from 'react'
import styles from './TonearmDevPanel.module.css'

const AXIS_LABELS = ['x', 'y', 'z']

function Vector3Sliders({ label, value, onChange, min, max, step }) {
  const handleAxisChange = (axisIndex, axisValue) => {
    const next = value.slice()
    next[axisIndex] = axisValue
    onChange(next)
  }

  return (
    <fieldset className={styles.group}>
      <legend>{label}</legend>
      {AXIS_LABELS.map((axisLabel, axisIndex) => (
        <label key={axisLabel} className={styles.row}>
          <span className={styles.axis}>{axisLabel}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value[axisIndex]}
            onChange={(event) => handleAxisChange(axisIndex, Number(event.target.value))}
          />
          <input
            type="number"
            step={step}
            value={value[axisIndex]}
            onChange={(event) => handleAxisChange(axisIndex, Number(event.target.value))}
            className={styles.number}
          />
        </label>
      ))}
    </fieldset>
  )
}

// Dev-only overlay for eyeballing tonearm position/rotation values in real
// time instead of round-tripping edit -> save -> reload against the
// TONEARM_DEFAULT_*/TONEARM_FINAL_* constants in HeroScene.jsx.
function TonearmDevPanel({ enabled, onToggleEnabled, position, rotation, onPositionChange, onRotationChange }) {
  // Starts collapsed so it stays out of the way during normal use; click the
  // tab to bring it back.
  const [isOpen, setIsOpen] = useState(false)

  const handleCopy = () => {
    const text = `position: [${position.map((v) => v.toFixed(3)).join(', ')}]\nrotation: [${rotation.map((v) => v.toFixed(3)).join(', ')}]`
    navigator.clipboard?.writeText(text).catch(() => {})
    console.log('[TonearmDevPanel]\n' + text)
  }

  if (!isOpen) {
    return (
      <button type="button" className={styles.openTab} onClick={() => setIsOpen(true)}>
        Tonearm dev panel
      </button>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>Tonearm dev panel</span>
        <button type="button" className={styles.closeButton} onClick={() => setIsOpen(false)}>
          Hide
        </button>
      </div>
      <label className={styles.toggle}>
        <input type="checkbox" checked={enabled} onChange={(event) => onToggleEnabled(event.target.checked)} />
        Override tonearm pose
      </label>
      <Vector3Sliders label="Position" value={position} onChange={onPositionChange} min={-2} max={2} step={0.005} />
      <Vector3Sliders label="Rotation (rad)" value={rotation} onChange={onRotationChange} min={-Math.PI} max={Math.PI} step={0.005} />
      <button type="button" className={styles.copyButton} onClick={handleCopy}>
        Copy values to clipboard / console
      </button>
    </div>
  )
}

export default TonearmDevPanel

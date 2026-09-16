import styles from './NowPlaying.module.css'

function NowPlaying({ visible }) {
  return (
    <div className={`${styles.nowPlaying} ${visible ? styles.visible : ''}`} aria-hidden={!visible}>
      <p className={styles.label}>Now Playing:</p>
      <p className={styles.title}>Bubbles and Candles</p>
      <p className={styles.credit}>originally written by Moveonout</p>
    </div>
  )
}

export default NowPlaying

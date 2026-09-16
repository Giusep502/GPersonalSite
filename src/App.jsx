import Header from './components/Header.jsx'
import HeroScene from './scenes/HeroScene.jsx'
import styles from './App.module.css'

function App() {
  return (
    <section className={styles.hero}>
      <Header />
      <div className={styles.canvasWrap}>
        <HeroScene />
      </div>
    </section>
  )
}

export default App

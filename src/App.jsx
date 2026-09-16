import Header from './components/Header.jsx'
import HeroScene from './scenes/HeroScene.jsx'
import About from './components/About.jsx'
import Experience from './components/Experience.jsx'
import Contact from './components/Contact.jsx'
import styles from './App.module.css'

function App() {
  return (
    <>
      <Header />
      <section className={styles.hero}>
        <div className={styles.canvasWrap}>
          <HeroScene />
        </div>
      </section>
      <main>
        <About />
        <Experience />
        <Contact />
      </main>
    </>
  )
}

export default App

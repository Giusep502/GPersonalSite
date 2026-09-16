import { useEffect, useState } from 'react'
import Header from './components/Header.jsx'
import HeroScene from './scenes/HeroScene.jsx'
import NowPlaying from './components/NowPlaying.jsx'
import About from './components/About.jsx'
import Experience from './components/Experience.jsx'
import Contact from './components/Contact.jsx'
import styles from './App.module.css'

// Only shown once scrolled back past this point — otherwise it'd overlap
// the hero content while the user is still down at About/Experience/Contact.
const AT_TOP_SCROLL_THRESHOLD = 10

function App() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isAtTop, setIsAtTop] = useState(true)

  useEffect(() => {
    const handleScroll = () => setIsAtTop(window.scrollY < AT_TOP_SCROLL_THRESHOLD)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      <Header />
      <section className={styles.hero}>
        <div className={styles.canvasWrap}>
          <HeroScene onPlayingChange={setIsPlaying} />
        </div>
      </section>
      <main>
        <About />
        <Experience />
        <Contact />
      </main>
      <NowPlaying visible={isPlaying && isAtTop} />
    </>
  )
}

export default App

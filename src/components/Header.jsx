import styles from './Header.module.css'

function Header() {
  return (
    <header className={styles.header}>
      <span className={styles.name}>Giuseppe</span>
      <ul className={styles.nav}>
        <li>
          <a href="#work">Work</a>
        </li>
        <li>
          <a href="#about">About</a>
        </li>
        <li>
          <a href="#contact">Contact</a>
        </li>
      </ul>
    </header>
  )
}

export default Header

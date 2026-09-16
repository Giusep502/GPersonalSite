import styles from './Contact.module.css'

function Contact() {
  return (
    <section id="contact" className={styles.contact}>
      <h2 className={styles.heading}>Get in touch</h2>
      <p className={styles.text}>Open to new opportunities and interesting conversations.</p>
      <div className={styles.links}>
        <a className={styles.button} href="mailto:giusep502@gmail.com">
          Say hello
        </a>
        <a
          className={styles.link}
          href="https://www.linkedin.com/in/giuseppe502"
          target="_blank"
          rel="noreferrer"
        >
          LinkedIn
        </a>
        <a
          className={styles.link}
          href="https://github.com/Giusep502"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </div>
    </section>
  )
}

export default Contact

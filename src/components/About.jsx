import styles from './About.module.css'

const skills = [
  { name: 'JavaScript', level: 'strong' },
  { name: 'Typescript', level: 'strong' },
  { name: 'HTML', level: 'strong' },
  { name: 'CSS', level: 'strong' },
  { name: 'React', level: 'strong' },
  { name: 'React Native', level: 'strong' },
  { name: 'GraphQL', level: 'strong' },
  { name: 'Claude Code', level: 'strong' },
  { name: 'Angular', level: 'familiar' },
  { name: 'SQL', level: 'familiar' },
  { name: 'Java', level: 'familiar' },
]

function About() {
  return (
    <section id="about" className={styles.about}>
      <h1 className={styles.name}>Giuseppe Di Francesco</h1>
      <p className={styles.role}>Senior Frontend Engineer — Milan, Italy</p>
      <p className={styles.bio}>
        Frontend Developer since 2015, with a solid foundation in backend technologies
        and software principles. Passionate about writing code and developing products
        that make a meaningful impact on users.
      </p>
      <ul className={styles.skills}>
        {skills.map((skill) => (
          <li
            key={skill.name}
            className={skill.level === 'familiar' ? styles.familiar : undefined}
          >
            <span className={styles.dot} aria-hidden="true" />
            {skill.name}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default About

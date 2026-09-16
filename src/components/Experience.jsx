import styles from './Experience.module.css'

const jobs = [
  {
    company: 'Unobravo',
    role: 'Senior Software Engineer',
    period: 'Jan 2022 – Present',
    location: 'Remote',
    description:
      'Tech lead for the Unobravo React frontend, driving architecture and technical direction across the team. Contributed to the React Native app and the design system, set up GitHub Actions CI/CD, and improved observability with Sentry and testing with Playwright. Also stepped into an engineering management role for a period, leading two teams.',
  },
  {
    company: 'Cloud Academy',
    role: 'Frontend Web Developer',
    period: 'May 2021 – Nov 2021',
    location: 'Mendrisio, Switzerland',
    description:
      'Built an enterprise web app with React in an Nx monorepo, a custom design system with styled-components, and a GraphQL-backed API. Added unit tests with Jest and integration tests with Cypress.',
  },
  {
    company: 'Sky Italia',
    role: 'Frontend Web Developer',
    period: 'Mar 2018 – May 2021',
    location: 'Milan, Italy',
    description:
      "Built Sky Italia's Personal Area web app in Angular 7+, TypeScript, RxJS and NgRx. Maintained legacy sites, mastering vanilla JavaScript, HTML5 and CSS3 along the way.",
  },
  {
    company: 'Alfagomma',
    role: 'Web Developer Intern',
    period: 'Feb 2015 – Aug 2015',
    location: 'Teramo, Italy',
    description:
      'Built internal CRUD web apps with AngularJS, REST APIs and WebSocket for real-time notifications.',
  },
]

const education = {
  school: 'Politecnico di Milano',
  degree: "Computer Science and Engineering — Master's Degree",
  period: 'Sep 2015 – Apr 2018',
  description:
    'Foundations in software engineering, compilers theory, functional programming and security. Thesis: a robot with a ROS, Python and JavaScript interface, built to interact with autistic people.',
}

function Experience() {
  return (
    <section id="work" className={styles.work}>
      <h2 className={styles.heading}>Experience</h2>
      <ol className={styles.timeline}>
        {jobs.map((job) => (
          <li key={job.company} className={styles.item}>
            <div className={styles.itemHeader}>
              <span className={styles.itemTitle}>{job.role}</span>
              <span className={styles.period}>{job.period}</span>
            </div>
            <div className={styles.itemSubheader}>
              <span>{job.company}</span>
              <span>{job.location}</span>
            </div>
            <p className={styles.description}>{job.description}</p>
          </li>
        ))}
      </ol>

      <h2 className={styles.heading}>Education</h2>
      <ol className={styles.timeline}>
        <li className={styles.item}>
          <div className={styles.itemHeader}>
            <span className={styles.itemTitle}>{education.degree}</span>
            <span className={styles.period}>{education.period}</span>
          </div>
          <div className={styles.itemSubheader}>
            <span>{education.school}</span>
          </div>
          <p className={styles.description}>{education.description}</p>
        </li>
      </ol>
    </section>
  )
}

export default Experience

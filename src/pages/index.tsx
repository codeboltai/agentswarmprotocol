import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <Heading as="h1" className={styles.heroTitle}>
              Agent Swarm Protocol
            </Heading>
            <p className={styles.heroSubtitle}>
              A standardized framework for creating, deploying, and orchestrating 
              collaborative AI agent systems
            </p>
            <div className={styles.heroButtons}>
              <Link
                className="button button--primary button--lg"
                to="/docs/intro">
                Get Started →
              </Link>
            </div>
          </div>
          <div className={styles.heroGraphic}>
            <div className={styles.graphicNodes}>
              <span className={styles.node} style={{animationDelay: '0s'}}></span>
              <span className={styles.node} style={{animationDelay: '0.4s'}}></span>
              <span className={styles.node} style={{animationDelay: '0.8s'}}></span>
              <span className={styles.node} style={{animationDelay: '1.2s'}}></span>
              <span className={styles.node} style={{animationDelay: '1.6s'}}></span>
              <div className={styles.connections}></div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function HomepageContent() {
  return (
    <div className={styles.contentSection}>
      <div className="container">
        <div className="row">
          <div className="col col--10 col--offset-1">
            <Heading as="h2" className={styles.sectionTitle}>
              Build Powerful AI Agent Systems
            </Heading>
            <p className={styles.sectionDescription}>
              Agent Swarm Protocol (ASP) provides a standardized framework for creating, deploying, and orchestrating networks of specialized AI agents that can collaborate on complex tasks.
            </p>
            
            <div className={styles.featuresGrid}>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>🔄</div>
                <h3>Dynamic Communication</h3>
                <p>Agents communicate directly with each other to collaborate on complex tasks without rigid workflow definitions.</p>
              </div>
              
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>🧠</div>
                <h3>Specialized Agents</h3>
                <p>Create purpose-built agents with specific capabilities that can work together to solve complex problems.</p>
              </div>
              
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>📈</div>
                <h3>Scalable Architecture</h3>
                <p>The protocol is designed to scale from simple two-agent interactions to complex swarms with dozens of specialized agents.</p>
              </div>
              
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>🔌</div>
                <h3>Flexible Integration</h3>
                <p>Easily integrate ASP with existing AI systems, language models, and APIs to extend capabilities.</p>
              </div>
            </div>
            
            <div className={styles.showcaseSection}>
              <Heading as="h2" className={styles.sectionTitle}>
                Ready-to-Use Agent Examples
              </Heading>
              <div className={styles.showcaseGrid}>
                <div className={styles.showcaseCard}>
                  <h3>Conversation Agent</h3>
                  <p>Natural language conversation agent with contextual memory and preference adaptation.</p>
                  <Link to="/docs/examples/conversation-agent">
                    Learn More →
                  </Link>
                </div>
                <div className={styles.showcaseCard}>
                  <h3>Research Agent</h3>
                  <p>Information gathering, analysis, and report generation for research tasks.</p>
                  <Link to="/docs/examples/research-agent">
                    Learn More →
                  </Link>
                </div>
              </div>
            </div>
            
            
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} - AI Agent Orchestration Framework`}
      description="Agent Swarm Protocol (ASP) is an open framework for creating, deploying, and orchestrating networks of specialized AI agents.">
      <HomepageHeader />
      <main>
        <HomepageContent />
      </main>
    </Layout>
  );
}

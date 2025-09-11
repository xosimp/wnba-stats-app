import React from 'react';
import Image from 'next/image';
import XLogo from '../../public/logos/X_Logo.svg';

const FAQS = [
  {
    question: 'What is NextGenHoops?',
    answer: 'NextGenHoops is a WNBA/NBA stats and predictions app designed to help fans and analysts get the most out of basketball data.'
  },
  {
    question: 'How do I use the Player Search?',
    answer: 'Navigate to the Player Search page to look up stats and information on your favorite professional basketball players.'
  },
  {
    question: 'How can I unlock projections?',
    answer: 'Sign in, then upgrade to the NBA + WNBA plan to access advanced projections and other premium features.'
  },
  // Add more FAQs as needed
];

export default function FAQFooter() {
  return (
    <footer style={{ background: '#181C24', color: '#fff', padding: '2.5rem 0', marginTop: '3rem', borderTop: '2px solid #71FD08', position: 'relative' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 1.5rem' }}>
        <h2 style={{ color: '#71FD08', fontWeight: 800, fontSize: '2rem', marginBottom: '1.5rem', letterSpacing: '0.01em', textShadow: '0 2px 8px #000, 0 1px 2px #000' }}>Frequently Asked Questions</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {FAQS.map((faq, idx) => (
            <div key={idx}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.3rem', color: '#71FD08' }}>{faq.question}</div>
              <div style={{ fontWeight: 400, fontSize: '1rem', color: '#fff', opacity: 0.92 }}>{faq.answer}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Social icons bottom right */}
      <div style={{
        position: 'absolute',
        right: '2.5rem',
        bottom: '2.5rem',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '1.2rem',
      }}>
        {/* Instagram icon as inline SVG */}
        <a
          href="https://www.instagram.com/dfssimp/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Follow on Instagram"
          className="instagram-logo-link"
          style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'none', transition: 'transform 0.18s cubic-bezier(.4,1.6,.6,1)' }}
        >
          <svg
            className="instagram-logo-svg"
            style={{ width: 50, height: 50, minWidth: 50, minHeight: 50, display: 'block', transition: 'filter 0.18s' }}
            viewBox="0 0 32 32"
            xmlns="http://www.w3.org/2000/svg"
            fill="#fff"
          >
            <path d="M20.445 5h-8.891A6.559 6.559 0 0 0 5 11.554v8.891A6.559 6.559 0 0 0 11.554 27h8.891a6.56 6.56 0 0 0 6.554-6.555v-8.891A6.557 6.557 0 0 0 20.445 5zm4.342 15.445a4.343 4.343 0 0 1-4.342 4.342h-8.891a4.341 4.341 0 0 1-4.341-4.342v-8.891a4.34 4.34 0 0 1 4.341-4.341h8.891a4.342 4.342 0 0 1 4.341 4.341l.001 8.891z"/>
            <path d="M16 10.312c-3.138 0-5.688 2.551-5.688 5.688s2.551 5.688 5.688 5.688 5.688-2.551 5.688-5.688-2.55-5.688-5.688-5.688zm0 9.163a3.475 3.475 0 1 1-.001-6.95 3.475 3.475 0 0 1 .001 6.95zM21.7 8.991a1.363 1.363 0 1 1-1.364 1.364c0-.752.51-1.364 1.364-1.364z"/>
          </svg>
        </a>
        {/* X (Twitter) icon as inline SVG */}
        <a
          href="https://x.com/DFSsimp"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Follow on X"
          className="x-logo-link"
          style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'none', transition: 'transform 0.18s cubic-bezier(.4,1.6,.6,1)' }}
        >
          <svg
            className="x-logo-svg"
            style={{ width: 32, height: 32, display: 'block', transition: 'stroke 0.18s' }}
            viewBox="0 0 300 300.251"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M178.57 127.15 290.27 0h-26.46l-97.03 110.38L89.34 0H0l117.13 166.93L0 300.25h26.46l102.4-116.59 81.8 116.59h89.34M36.01 19.54H76.66l187.13 262.13h-40.66"
              fill="none"
              stroke="#fff"
              strokeWidth="16"
              strokeLinejoin="round"
            />
          </svg>
        </a>
        <style jsx>{`
          .instagram-logo-link:hover {
            transform: scale(1.18);
          }
          .instagram-logo-link:hover .instagram-logo-svg path {
            fill: #71FD08 !important;
          }
          .x-logo-link:hover {
            transform: scale(1.18);
          }
          .x-logo-link:hover .x-logo-svg path {
            stroke: #71FD08 !important;
          }
        `}</style>
      </div>
    </footer>
  );
} 
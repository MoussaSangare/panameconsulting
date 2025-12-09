import React from 'react';

const Loader: React.FC = () => {
  return (
    <div
      className='fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center'
      aria-live='assertive'
      aria-busy='true'
    >
      <style>{`
        @keyframes orbit {
          0% { transform: rotate(0deg) translateX(20px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(20px) rotate(-360deg); }
        }
        @keyframes pulse-opacity {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      <div className='relative w-24 h-24'>
        {/* Cercle principal */}
        <div className='absolute inset-0 border-[3px] border-sky-100 rounded' />

        {/* Élément orbital animé */}
        <div
          className='absolute top-1/2 left-1/2 w-4 h-4 bg-sky-500 rounded shadow-sm'
          style={{
            transform: 'translate(-50%, -50%)',
            animation: 'orbit 1.5s linear infinite',
          }}
        />

        {/* Points satellites */}
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className='absolute w-2 h-2 bg-sky-400'
            style={{
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) rotate(${i * 90}deg) translateX(30px)`,
              opacity: 0.7,
              animation: 'pulse-opacity 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default React.memo(Loader);

import React from "react";
import { motion } from "framer-motion";

export default function InstructionsCard({ darkMode }) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      whileHover={{
        background: "linear-gradient(135deg, rgba(168,85,247,0.03), rgba(236,72,153,0.03), rgba(59,130,246,0.02))",
        transition: { duration: 0.4 },
      }}
      className="mt-8 bg-white/2 backdrop-blur-lg rounded-2xl p-6 border border-white/10 shadow-md max-w-3xl mx-auto transition-all duration-500"
    >
      <h2 className={`text-xl md:text-2xl font-bold text-center mb-6 tracking-wide ${darkMode ? 'text-white' : 'text-gray-800'}`}>
        Instructions
      </h2>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h3 className={`font-semibold mb-3 text-base md:text-lg ${darkMode ? 'text-white' : 'text-gray-800'}`}>Recording</h3>
          <ul className={`ml-4 space-y-1 text-xs list-disc marker:text-pink-400 leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            <li>
              <span>Click <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>"Start Recording"</span> to begin</span>
            </li>
            <li>Face tracking markers will appear automatically</li>
            <li>
              Click <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>"Stop Recording"</span> when finished
            </li>
            <li>Download or save videos locally</li>
          </ul>
        </div>

        <div>
          <h3 className={`font-semibold mb-3 text-base md:text-lg ${darkMode ? 'text-white' : 'text-gray-800'}`}>Features</h3>
          <ul className={`ml-4 space-y-1 text-xs list-disc marker:text-purple-400 leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            <li>Real-time face detection</li>
            <li>
              Dual video recording <span className={`${darkMode ? 'text-white/80' : 'text-gray-700'}`}>(raw + overlay)</span>
            </li>
            <li>Local storage integration</li>
            <li>Mobile responsive design</li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

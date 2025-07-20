import React, { useState } from "react";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const handleScroll = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 w-full backdrop-blur-md py-3 px-6 z-50 bg-gradient-to-b">
      <div className="flex items-center justify-between text-white">
        {/* Logo */}
        <div
          className="text-lg font-bold bg-gradient-to-r from-sky-400 via-purple-400 to-pink-400 bg-clip-text text-transparent cursor-pointer"
          onClick={() => handleScroll("home")}
        >
          Face Tracker and Recorder
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-8 text-md font-medium">
          <button
            onClick={() => handleScroll("services")}
            className="hover:scale-105 transition-transform duration-200 hover:text-gray-300"
          >
            Services
          </button>
          <button
            onClick={() => handleScroll("plans")}
            className="hover:scale-105 transition-transform duration-200 hover:text-gray-300"
          >
            Plans
          </button>
          <button
            onClick={() => handleScroll("contact")}
            className="hover:scale-105 transition-transform duration-200 hover:text-gray-300"
          >
            Contact
          </button>
        </div>

        {/* Mobile Menu Icon */}
        <div className="md:hidden">
          <button onClick={toggleMenu} className="flex flex-col justify-center items-center w-8 h-8 space-y-1">
            {/* Hamburger / Close animation */}
            <span
              className={`block h-0.5 w-6 bg-white transition-transform duration-300 ${
                menuOpen ? "rotate-45 translate-y-1.5" : ""
              }`}
            ></span>
            <span
              className={`block h-0.5 w-6 bg-white transition-all duration-300 ${
                menuOpen ? "opacity-0" : ""
              }`}
            ></span>
            <span
              className={`block h-0.5 w-6 bg-white transition-transform duration-300 ${
                menuOpen ? "-rotate-45 -translate-y-1.5" : ""
              }`}
            ></span>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {menuOpen && (
        <div className="md:hidden mt-4 bg-gradient-to-b p-4 rounded-md shadow-lg space-y-4 text-sm font-medium">
          <button
            onClick={() => handleScroll("login")}
            className="block w-full text-left hover:text-gray-300"
          >
            Login
          </button>
          <button
            onClick={() => handleScroll("get-started")}
            className="block w-full text-left hover:text-gray-300"
          >
            Get Started
          </button>
          <button
            onClick={() => handleScroll("services")}
            className="block w-full text-left hover:text-gray-300"
          >
            Services
          </button>
          <button
            onClick={() => handleScroll("plans")}
            className="block w-full text-left hover:text-gray-300"
          >
            Plans
          </button>
          <button
            onClick={() => handleScroll("about")}
            className="block w-full text-left hover:text-gray-300"
          >
            About Us
          </button>
          <button
            onClick={() => handleScroll("contact")}
            className="block w-full text-left hover:text-gray-300"
          >
            Contact
          </button>
        </div>
      )}
    </nav>
  );
}

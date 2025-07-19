import React from "react";


export default function Navbar() {
  const handleScroll = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }
  return (
    
    <nav className="fixed top-0 left-0 w-full backdrop-blur-md py-3 z-50">
      <div className="flex items-center justify-center gap-10">

        <div className="flex items-center gap-8 text-white text-md font-medium">
        <button
  onClick={() => handleScroll("work")}
  className="hover:scale-105 transition-transform duration-200 hover:text-gray-300"
>
  Projects
</button>

<button
  onClick={() => handleScroll("aboutme")}
  className="hover:scale-105 transition-transform duration-200 hover:text-gray-300"
>
  About Me
</button>

<a
  href="https://mail.google.com/mail/?view=cm&to=sroydeb2022@gmail.com"
  className="hover:scale-105 transition-transform duration-200 hover:text-gray-300 inline-block"
>
  Contact Me
</a>

        </div>
      </div>
    </nav>
  );
}

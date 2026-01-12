import React, { useEffect } from "react";

export default function ThemeProvider({ name = "frosted", children }) {
  useEffect(() => {
    const classes = [];
    if (name === "frosted") {
      classes.push("theme-frosted", "theme-frosted-bokeh");
    } else if (name) {
      classes.push(String(name));
    }
    classes.forEach((c) => document.body.classList.add(c));
    return () => classes.forEach((c) => document.body.classList.remove(c));
  }, [name]);
  return <>{children}</>;
}

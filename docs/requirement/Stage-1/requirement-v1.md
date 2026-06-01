
### Prompt

You are given an existing, simple basketball statistics program written in Python located in this directory. The program currently runs only as a command‑line tool.

Your task is to **refactor and extend this program into a web application with a graphical Web UI**, while preserving all original functionality.

#### Functional Requirements

1.  Convert the existing command‑line basketball statistics program into a **web-based application**.
2.  The Web UI must:
    *   Provide **buttons for every existing command** supported by the original program.
    *   Include a **text input box** that allows users to enter commands manually, similar to the original command-line interface.
3.  The web application must be **deployable on Cloudflare Pages**.
    *   Use a Cloudflare Pages–compatible stack (e.g., static frontend + serverless functions / Workers, if needed).
    *   Do not rely on services that are incompatible with Cloudflare Pages.

#### UI / UX Requirements

1.  The overall color scheme and styling must match the **Saint Francis High School (Mountain View, CA)** brand aesthetic.
    *   Use school-appropriate tones (e.g., maroon / red / white / gray).
2.  The school logo must be displayed in the interface:
    *   Logo file: `logo_main.svg`
    *   Place it prominently (e.g., header or top-left corner).
3.  The page footer must display:
    *   Text: **“Powered by Ethan Liu”**
    *   Alongside the image file: `ethan-v3.png`
4.  CSV export functionality should be available anytime.

#### Technical Guidelines

1.  Maintain clean separation between:
    *   Application logic (basketball stats logic)
    *   UI layer
2.  Ensure the application is easy to extend with additional commands in the future.
3.  The UI should be responsive and usable on both desktop and tablet screens.
4.  All existing commands should behave identically to the original Python CLI version.

#### Deliverables

*   A working web application with the required UI features
*   Updated project structure suitable for Cloudflare Pages deployment
*   Clear instructions on how to build and deploy the app to Cloudflare Pages

Focus on clarity, maintainability, and faithful preservation of the original program’s behavior while providing a modern web-based user experience.


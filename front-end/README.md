# Front-end Static Site Generator

This is a static site generator using Handlebars templates to build HTML pages for the Vikki CVP project.

## Project Structure

- **pages/**: Contains individual page templates
- **components/**: Contains reusable Handlebars partials
- **layouts/**: Contains layout templates (including base.hbs)
- **data/**: Contains JSON data files for each page
- **build.js**: The build script that compiles templates and outputs HTML

## Build Process

The build process works as follows:

1. Registers all components and layouts as Handlebars partials
2. For each page in the `pages` directory:
   - Compiles the page template with its corresponding data from the `data` directory
   - Wraps the page content in the base layout
   - Outputs the HTML to the `../vikki-cvp` directory

## Usage

### Installation

```bash
npm install
```

### Build

To build the site:

```bash
npm run build
```

This will generate HTML files in the `../vikki-cvp` directory.

`CVP_DATA_DIR`, `CVP_OUT_DIR` and `CVP_PAGES_DIR` point a build at another copy of `data/`, another output folder and another copy of `pages/`. `CVP_ONLY_PAGE=<folder>` builds that one page folder. The admin's round-trip checks and its preview use them (see `../admin/README.md`); left unset, the build is unchanged:

```bash
CVP_DATA_DIR=/tmp/data CVP_OUT_DIR=/tmp/out node build.js
```

### Development Mode

To start development mode with live reloading:

```bash
npm run dev
```

This will:
- Build all pages
- Watch for changes in pages, components, layouts, and data directories
- Rebuild all pages when changes are detected
- Start a local server on port 3000

You can then view the site at http://localhost:3000/vikki-cvp

## Adding New Pages

To add a new page:

1. Create a new directory in the `pages` directory (e.g., `pages/new-page/`)
2. Create a Handlebars template with the same name as the directory (e.g., `pages/new-page/new-page.hbs`)
3. Optionally, create a JSON data file in the `data` directory (e.g., `data/new-page/new-page.json`)
4. Run the build command

## Creating Components

To create a reusable component:

1. Create a Handlebars partial in the `components` directory (e.g., `components/button.hbs`)
2. Use the component in your page templates with `{{> button}}`

## Using the Comprehensive Template

A comprehensive template has been created that supports all components used in the project. This template can be used to build any page by passing the appropriate JSON data.

See the `layouts/README.md` file for detailed documentation on how to use the template.

### Example

The `template-example` page demonstrates how to use the comprehensive template. It uses the JSON data from `data/template-example.json` to build a page with various components.

To build a page using the template:

1. Create a new directory in the `pages` directory (e.g., `pages/my-page/`)
2. Create a simple Handlebars template in that directory (e.g., `pages/my-page/my-page.hbs`)
3. Create a JSON data file in the `data` directory (e.g., `data/my-page/my-page.json`) with the appropriate structure
4. Add a `layout` property to your JSON data file to specify which layout to use (e.g., `"layout": "template"`)
5. Run the build command

### Specifying a Layout

You can specify which layout to use for a page by adding a `layout` property to your JSON data file:

```json
{
  "title": "My Page",
  "layout": "template",
  "other": "data"
}
```

This will use the `layouts/template.hbs` layout for your page. If no layout is specified, the default `layouts/base.hbs` layout will be used.

Before creating PR related to promotion, update checklist below: https://docs.google.com/spreadsheets/d/1BaDIpM4OMhwst-i9SynA4qVbPDzWzu0mF8bvueXm6oE/edit?usp=sharing

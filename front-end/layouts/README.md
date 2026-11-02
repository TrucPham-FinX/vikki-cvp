# Template Layout

This directory contains layout templates for the Vikki CVP project.

## Base Layout (base.hbs)

The base layout is a simple template that includes:
- Basic HTML structure
- Header component
- Footer component
- Body content

## Comprehensive Template (template.hbs)

The comprehensive template is a more flexible layout that supports all components used in the project. It can be used to build any page by passing the appropriate JSON data.

### Usage

To use the template, create a page in the `pages` directory and a corresponding JSON data file in the `data` directory. The build script will automatically use the template layout for pages named `template-example`.

For other pages, you can modify the `build.js` file to use the template layout based on the page name or other criteria.

### Flexible Component Ordering

The template supports flexible component ordering through the `components` array. This allows you to specify the order of components in your page, making it possible to create different layouts for different pages.

For example, one page could have the order: top menu → image → slider → Q&A, while another page could have: top menu → slider → Q&A → image.

To use this feature, add a `components` array to your JSON data with each component having a `type` field that identifies the component type. The components will be rendered in the order they appear in the array.

Example:
```json
{
  "title": "Page Title",
  "hasTopSpace": true,
  "components": [
    {
      "type": "video"
    },
    {
      "type": "topMenu",
      "items": [
        {
          "title": "Menu Item",
          "text": "Menu Text"
        }
      ]
    },
    {
      "type": "imageSection",
      "src": "./assets/image.png"
    },
    {
      "type": "slider",
      "title": {
        "src": "./assets/title.png"
      },
      "items": [
        {
          "src": "./assets/slide.png"
        }
      ]
    },
    {
      "type": "qa",
      "title": {
        "src": "./assets/qa.png"
      },
      "items": [
        {
          "title": "Question",
          "content": "Answer"
        }
      ]
    }
  ]
}
```

### JSON Data Structure

The template supports the following JSON data structure:

```json
{
  "title": "Page Title",
  "hasTopSpace": true,
  "components": [
    {
      "type": "video"
    },
    {
      "type": "topMenu",
      "items": [
        {
          "title": "Menu Item Title",
          "text": "Menu Item Text",
          "iconSrc": "./assets/icon.svg",
          "popup": "popup-id-or-url",
          "scroll": "#section-id"
        }
      ]
    },
    {
      "type": "content",
      "content": "HTML content for the main section"
    },
    {
      "type": "imageSection",
      "src": "./assets/image.png",
      "id": "section-id",
      "link": "https://example.com",
      "linkTitle": "Link Title"
    },
    {
      "type": "slider",
      "title": {
        "src": "./assets/slider-title.png"
      },
      "items": [
        {
          "src": "assets/slide-1.png",
          "popupLink": "https://example.com",
          "popupTitle": "Popup Title"
        }
      ]
    },
    {
      "type": "qa",
      "title": {
        "src": "./assets/qa-title.png"
      },
      "button": {
        "iconSrc": "./assets/qa-icon.svg",
        "text": "Q&A Button Text"
      },
      "items": [
        {
          "title": "Question",
          "content": "Answer HTML"
        }
      ]
    },
    {
      "type": "cardInfo",
      "container": "pt-1",
      "cellClass": "text-center",
      "title": {
        "src": "./assets/title.png",
        "className": "!w-[80%]"
      },
      "images": [
        {
          "src": "./assets/image1.png"
        },
        {
          "src": "./assets/image2.png"
        }
      ]
    },
    {
      "type": "activation",
      "bgClass": "bg-green",
      "title": {
        "src": "./assets/title.png"
      },
      "image": {
        "src": "./assets/image.png"
      },
      "feeButton": {
        "title": "Fee Button Title",
        "popup": "https://example.com",
        "text": "Fee Button Text"
      },
      "termsButton": {
        "title": "Terms Button Title",
        "popup": "https://example.com",
        "text": "Terms Button Text"
      }
    }
  ],

  "_legacyFormat": "The following properties are for backward compatibility",
  "showVideo": true,
  "topMenu": [
    {
      "title": "Menu Item Title",
      "text": "Menu Item Text",
      "iconSrc": "./assets/icon.svg",
      "popup": "popup-id-or-url",
      "scroll": "#section-id"
    }
  ],
  "content": "HTML content for the main section",
  "showSlider": true,
  "sliderTitle": {
    "src": "./assets/slider-title.png"
  },
  "slider": [
    {
      "src": "assets/slide-1.png",
      "popupLink": "https://example.com",
      "popupTitle": "Popup Title"
    }
  ],
  "showQA": true,
  "qaTitle": {
    "src": "./assets/qa-title.png"
  },
  "qaButton": {
    "iconSrc": "./assets/qa-icon.svg",
    "text": "Q&A Button Text"
  },
  "qa": [
    {
      "title": "Question",
      "content": "Answer HTML"
    }
  ]
}
```

### Properties

- `title`: The page title
- `hasTopSpace`: Whether to add top space to the body
- `showVideo`: Whether to show the video component
- `topMenu`: Array of top menu items
  - `title`: The title attribute for the menu item
  - `text`: The text to display
  - `iconSrc`: The source URL for the icon
  - `popup`: The popup ID or URL (optional)
  - `scroll`: The section ID to scroll to (optional)
- `content`: HTML content for the main section

- `imageSections`: Array of image sections to display
  - `src`: The source URL for the image
  - `id`: The ID attribute for the image (optional)
  - `className`: The class name for the container (optional)
  - `cellClassName`: The class name for the cell (optional)
  - `imgClassName`: The class name for the image (optional)
  - `link`: The URL to open in a popup (optional)
  - `linkTitle`: The title for the popup (optional)

- `showSlider`: Whether to show the slider component
- `sliderTitle`: Object with properties for the slider title
  - `src`: The source URL for the title image
- `slider`: Array of slider items
  - `src`: The source URL for the slide image
  - `popupLink`: The URL to open in a popup (optional)
  - `popupTitle`: The title for the popup (optional)

- `showCardInfo`: Whether to show the card information section
- `cardInfoContainer`: The class name for the container (optional, defaults to 'pt-1')
- `cardInfoCellClass`: The class name for the cell (optional, defaults to 'text-center')
- `cardInfoTitle`: Object with properties for the card info title
  - `src`: The source URL for the title image
  - `className`: The class name for the title image (optional, defaults to '!w-[80%]')
- `cardInfoImages`: Array of images to display in the card info section
  - `src`: The source URL for the image
  - `className`: The class name for the image (optional)

- `showQA`: Whether to show the Q&A section
- `qaTitle`: Object with properties for the Q&A title
  - `src`: The source URL for the title image
- `qaButton`: Object with properties for the Q&A button
  - `iconSrc`: The source URL for the button icon
  - `text`: The text to display on the button
- `qa`: Array of Q&A items
  - `title`: The question
  - `content`: The answer HTML

- `showActivation`: Whether to show the activation information section
- `activationBgClass`: The background class for the activation section (optional, defaults to 'bg-green')
- `activationClass`: Additional class for the activation section (optional)
- `activationTitle`: Object with properties for the activation title
  - `src`: The source URL for the title image
- `activationImage`: Object with properties for the activation image
  - `src`: The source URL for the image
- `feeButton`: Object with properties for the fee button
  - `title`: The title attribute for the button
  - `popup`: The URL to open in a popup
  - `text`: The text to display on the button
- `termsButton`: Object with properties for the terms button
  - `title`: The title attribute for the button
  - `popup`: The URL to open in a popup
  - `text`: The text to display on the button

### Example

See the `template-example.json` file in the `data` directory for an example of how to use the template.

---
title: "{{ replace .TranslationBaseName "-" " " | title }}"
date: {{ .Date }}
draft: false
description: This is the caption.
photo:
  url: 's3/images/something.jpg'
  thumb: 's3/thumbs/something.jpg'
  preview: 's3/previews/something.jpg'
  created: {{ .Date }}
  title: ''
  caption: ''
---

---
title: "{{ replace .TranslationBaseName "-" " " | title }}"
date: {{ .Date }}
draft: true
description: This is the caption.
photo:
  url: 's3/images/something.jpg'
  thumb: 's3/thumbs/something.jpg'
  created: {{ .Date }}
  title: ''
  caption: ''
---

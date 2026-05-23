# Imagem hero do login

Salve a imagem nesta pasta com o nome **exato**:

```
public/login-hero.jpg
```

## Especificação técnica recomendada

- **Formato**: JPG (otimizado pra peso) ou PNG (se tiver transparência)
- **Resolução mínima**: 1920×1080 px
- **Peso ideal**: até 400 KB (use [tinypng.com](https://tinypng.com) pra comprimir)
- **Conteúdo recomendado**: cena com identidade visual Terra Roxa + TR Trading (caminhão, silos, logos das 2 empresas)

## Como aparece no sistema

- **Desktop (>900px)**: ocupa o lado esquerdo da tela de login (60% da largura)
- **Mobile (<900px)**: imagem some, fundo fica gradiente roxo

## Como atualizar depois

Basta substituir o arquivo `public/login-hero.jpg` com a nova imagem (mesmo nome). Commit + push e o Vercel re-deploya.

## Enquanto o arquivo não existir

O CSS tem fallback: cor sólida escura (#1a1320). Não quebra a página, só fica feio. Suba a imagem o quanto antes pro visual completo aparecer.

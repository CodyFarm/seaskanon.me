标题: <%+ tp.file.title %>
创建时间: <% tp.file.creation_date() %> 
当前时间 <% tp.date.now("YYYY-MM-DD") %>
昨天时间<% tp.date.now("YYYY-MM-DD", -1) %>
修改时间: <%+ tp.file.last_modified_date() %> 
<% tp.web.random_picture("200x200", "landscape,water") %>
笔记正文：<% tp.file.content %>
<% tp.frontmatter.alias %>
每日一句：<%+ tp.web.daily_quote() %>


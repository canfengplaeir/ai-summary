const url = 'http://121.199.22.180:3000/';
const message = `今天的博客文章讨论了人工智能在医疗领域的应用。文章首先介绍了AI在诊断方面的优势,包括快速分析大量医疗图像和数据的能力。接着,文章探讨了AI辅助药物研发的潜力,如何加速新药发现过程。然后,文章讨论了AI在个性化治疗方案制定中的作用,如何根据患者的基因信息和病史提供更精准的治疗建议。最后,文章提到了AI在远程医疗和健康监测方面的应用,如何通过智能设备持续监控患者的健康状况。文章结论认为,尽管AI在医疗领域有巨大潜力,但仍需要解决数据隐私、伦理问题等挑战。`;

const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message })
};

fetch(url, requestOptionodens)
    .then(response => response.json())
    .then(data => {
        console.log('摘要:', data.choices[0].message.content);
    })
    .catch(error => {
        console.error('错误:', error);
    });
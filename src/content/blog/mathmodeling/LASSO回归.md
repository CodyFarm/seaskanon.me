---
tags:
  - statistics
pubDate: 2026-07-12
title: LASSO回归
description: LASSO回归通过L1正则化实现变量选择与防止过拟合，是高维数据分析中的常用方法。本文详解其数学原理、与岭回归的对比、优缺点及R语言实战。
categories: quote
icon: "1"
series: mathmodeling
series_id: "1"
firstLetterColor: salmon
heroImage: \src\content\blog\mathmodeling\assets\LASSO回归.avif
---


在回归分析中，当数据存在[多重共线性](https://zhida.zhihu.com/search?content_id=259618665&content_type=Article&match_order=1&q=%E5%A4%9A%E9%87%8D%E5%85%B1%E7%BA%BF%E6%80%A7&zhida_source=entity)（即自变量之间高度相关）或当变量较多时，传统的 [最小二乘法](https://zhida.zhihu.com/search?content_id=259618665&content_type=Article&match_order=1&q=%E6%9C%80%E5%B0%8F%E4%BA%8C%E4%B9%98%E6%B3%95&zhida_source=entity)（OLS, Ordinary Least Squares） 可能会导致过拟合，使得模型的泛化能力下降。为了解决这些问题，**[岭回归](https://zhida.zhihu.com/search?content_id=259618665&content_type=Article&match_order=1&q=%E5%B2%AD%E5%9B%9E%E5%BD%92&zhida_source=entity)**（Ridge Regression） 和 **[Lasso 回归](https://zhida.zhihu.com/search?content_id=259618665&content_type=Article&match_order=1&q=Lasso+%E5%9B%9E%E5%BD%92&zhida_source=entity)**（Least Absolute Shrinkage and Selection Operator, Lasso） 作为两种正则化方法被提出。

Lasso 回归通过引入**L1 正则化**，使得某些回归系数趋近于零，甚至直接变为零，从而实现变量选择的功能。因此，Lasso 回归不仅能够降低模型复杂度，还能提升模型的可解释性，是高维数据分析中的常用方法。

## **一、基本概念**

Lasso 回归是一种 带 L1 正则化的线性回归方法，它的目标是最小化以下损失函数：

J(β)\=∑i\=1n(yi−yi^)2+λ∑j\=1pβj|

其中：

-   yi 是目标变量（因变量）
-   yi^ 是模型预测值
-   βj 是回归系数
-   λ 是[正则化超参数](https://zhida.zhihu.com/search?content_id=259618665&content_type=Article&match_order=1&q=%E6%AD%A3%E5%88%99%E5%8C%96%E8%B6%85%E5%8F%82%E6%95%B0&zhida_source=entity)（惩罚项强度），控制回归系数的收缩程度
-   p 是自变量的数量

Lasso 回归的核心在于**L1罚项**，即**绝对值和惩罚**，它的特点是可以使部分回归系数变为零，因此可以用于**特征选择**。

## **二、数学原理**

### **3.1 Lasso 回归优化目标**

Lasso 回归的优化目标是最小化带有L1正则化项的**残差平方和（RSS, Residual Sum of Squares）**，即

minβ⁡∑i\=1n(yi−Xiβ)2+λ∑j\=1p|βj|

L1 正则化的作用：

1.  **收缩系数（Shrinkage）**：L1 罚项会迫使一些回归系数趋向于零，使得模型更简单。
2.  **变量选择（Feature Selection）**：当 λ 逐渐增大时，某些特征的系数会直接变为零，从而自动选择重要特征。

### **3.2 Lasso 与岭回归的比较**

![](https://picx.zhimg.com/v2-bcf8bb6dc2db51ddaad08de1cffd1d23_1440w.jpg)

## **三、岭回归的优缺点**

### **3.1 优点**

1.  **自动特征选择**：Lasso 通过 L1 正则化，可以自动剔除不重要的特征，使得模型更简洁。
2.  **防止过拟合**：通过引入正则化项，Lasso 可以有效控制模型复杂度，避免过拟合问题。
3.  **适用于高维数据**：在高维数据（特征数远多于样本数）中，Lasso 可以帮助降维，提高计算效率。。

### **3.2 缺点**

1.  **可能会丢弃重要特征**：如果某些特征与目标变量相关性较弱但仍然重要，Lasso 可能会错误地将其系数设为 0。
2.  **计算开销较大**：相比于岭回归，Lasso 由于涉及 L1 约束，优化问题更加复杂，计算成本较高。

## **四、应用范围**

Lasso回归特别适用于以下几种情况：

-   **高维数据建模**：当数据集包含大量特征（如基因数据、文本分析等），Lasso 可用于自动选择重要特征。
-   **特征选择**：在多重共线性严重的情况下，Lasso 可帮助消除冗余变量，提高模型的解释性。
-   **降维**：Lasso 可在不影响模型性能的前提下，通过自动变量选择实现降维。

Lasso 回归的评估方法与普通线性回归类似，但需要重点关注 正则化超参数 的选择。

选择合适的 值至关重要，通常使用 **[K 折交叉验证](https://zhida.zhihu.com/search?content_id=259618665&content_type=Article&match_order=1&q=K+%E6%8A%98%E4%BA%A4%E5%8F%89%E9%AA%8C%E8%AF%81&zhida_source=entity)（K-Fold Cross-Validation）** 进行调优。

## **六、实战例子（R）**

部分代码：

```r
# 读取数据集
boston <- read.csv("data/BostonHousing.csv")
# 数据清洗
df <- boston %>%             
  mutate(across(where(is.character), as.factor)) %>%  # 转换字符列为因子
  na.omit()                    # 移除缺失值
# 分离特征和响应变量
X <- model.matrix(~ . - 1, data = select(df, -medv))  # 自动处理因子变量
y <- df$medv  # 调整后的房价中位数（千美元）
# 数据标准化 -----------------------
preProc <- preProcess(X, method = c("center", "scale"))
X_scaled <- predict(preProc, X)
# 划分训练集/测试集 -----------------
trainIndex <- createDataPartition(y, p = 0.8, list = FALSE)
X_train <- X_scaled[trainIndex, ]
y_train <- y[trainIndex]
X_test <- X_scaled[-trainIndex, ]
y_test <- y[-trainIndex]
# Lasso回归建模 --------------------
lambda_seq <- 10^seq(-4, 2, length.out = 100)  # 正则化参数范围
cv_fit <- cv.glmnet(
  x = X_train,
  y = y_train,
  alpha = 1,         # Lasso回归
  lambda = lambda_seq,
  nfolds = 10,       # 10折交叉验证
  standardize = FALSE # 已预先标准化
)
# 结果分析 -------------------------
best_lambda <- cv_fit$lambda.min
final_model <- glmnet(
  x = X_train,
  y = y_train,
  alpha = 1,
  lambda = best_lambda,
  standardize = FALSE
)
# 模型预测
train_pred <- predict(final_model, newx = X_train)
test_pred <- predict(final_model, newx = X_test)
# 计算R²
r2_train <- cor(y_train, train_pred)^2
r2_test <- cor(y_test, test_pred)^2
# 提取系数
coef_df <- coef(final_model) %>%
  as.matrix() %>%
  as.data.frame() %>%
  tibble::rownames_to_column("feature") %>%
  filter(feature != "(Intercept)") %>%
  rename(coef = s0) %>%
  arrange(desc(abs(coef)))
# 系数稳定性分析
coef_path <- cv_fit$glmnet.fit$beta
coef_sd <- apply(coef_path, 1, sd)
```



处理结果：

![](https://pic1.zhimg.com/v2-39f28bb9da8034c87ae059cefa647a96_1440w.jpg)

正则化路径图

![](https://pic4.zhimg.com/v2-0fc8227f0f081540e2ff967735a2d093_1440w.jpg)

系数重要性图

![](https://pica.zhimg.com/v2-4fabc814c544d7ffc123bfd009655b16_1440w.jpg)

最终预测图

结果：

![](https://pic1.zhimg.com/v2-ef777483ccf60694de195d4529b6708c_1440w.jpg)

## **七、总结**

Lasso 回归通过 **L1 正则化**进行变量选择，使得模型更加精简，同时能够有效降低过拟合风险。适用于高维数据分析场景，但需要注意合适的正则化强度 。通过交叉验证选取最优参数，并结合评估指标，可以确保模型的稳定性和准确性。

在回归分析中，当数据存在[多重共线性](https://zhida.zhihu.com/search?content_id=259618665&content_type=Article&match_order=1&q=%E5%A4%9A%E9%87%8D%E5%85%B1%E7%BA%BF%E6%80%A7&zhida_source=entity)（即自变量之间高度相关）或当变量较多时，传统的 [最小二乘法](https://zhida.zhihu.com/search?content_id=259618665&content_type=Article&match_order=1&q=%E6%9C%80%E5%B0%8F%E4%BA%8C%E4%B9%98%E6%B3%95&zhida_source=entity)（OLS, Ordinary Least Squares） 可能会导致过拟合，使得模型的泛化能力下降。为了解决这些问题，**[岭回归](https://zhida.zhihu.com/search?content_id=259618665&content_type=Article&match_order=1&q=%E5%B2%AD%E5%9B%9E%E5%BD%92&zhida_source=entity)**（Ridge Regression） 和 **[Lasso 回归](https://zhida.zhihu.com/search?content_id=259618665&content_type=Article&match_order=1&q=Lasso+%E5%9B%9E%E5%BD%92&zhida_source=entity)**（Least Absolute Shrinkage and Selection Operator, Lasso） 作为两种正则化方法被提出。在之前的文章中我们介绍了岭回归，接下来我们将继续学习Lasso回归分析。

Lasso 回归通过引入**L1 正则化**，使得某些回归系数趋近于零，甚至直接变为零，从而实现变量选择的功能。因此，Lasso 回归不仅能够降低模型复杂度，还能提升模型的可解释性，是高维数据分析中的常用方法。


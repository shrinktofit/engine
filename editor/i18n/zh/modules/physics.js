/* eslint-disable quote-props */

module.exports = {
    classes: {
        'cc': {
            'PhysicsMaterial': {
                properties: {
                    'friction': {
                        displayName: '摩擦系数',
                        tooltip:
                            '摩擦系数。值越大，越难让物体在接触面移动且移动速度也会降低得更快。' +
                            '摩擦系数为 0 的感觉就像冰。',
                    },
                    'rollingFriction': {
                        displayName: '滚动摩擦系数',
                        tooltip: '滚动摩擦系数。注意，此属性仅在 Bullet 后端中支持。',
                    },
                    'spinningFriction': {
                        displayName: '自旋摩擦系数',
                        tooltip: '自旋摩擦系数。注意，此属性仅在 Bullet 后端中支持。',
                    },
                    'frictionCombineMode': {
                        displayName: '摩擦系数结合模式',
                        tooltip: '指定如何结合两个对象的摩擦系数。',
                    },
                    'restitution': {
                        displayName: '弹性系数',
                        tooltip:
                            '弹性系数。取值范围为 [0, 1]。' +
                            '值越大，碰撞后动能损失越小。' +
                            '弹性系数为 0 的物体碰撞后损失所有动能，将不会回弹，其感觉就像海绵；' +
                            '弹性系数为 1 的物体碰撞后不会有动能损失，将无限次回弹，其感觉就像橡胶球。',
                    },
                    'restitutionCombineMode': {
                        displayName: '弹性系数结合模式',
                        tooltip: '指定如何结合两个对象的弹性系数。',
                    },
                },
            },
        },
    },
};

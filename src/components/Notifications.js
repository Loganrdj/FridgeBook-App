import React, {Component } from 'react';
import "./style.css";
import IngredientAlert from './IngredientAlert';
import { daysUntil } from '../utils/dates';

class Notifications extends Component {

    constructor(props) {
        super(props)
        this.state = {props}
    }

    render() {
        return (
            <div className="container">
                <div className="row">
                    {this.props.ingredients ? this.props.ingredients.map(item => {
                        let remain = daysUntil(item.date_expire);
                        if (remain !== null) {
                            return (<IngredientAlert key={item.id} item={item} remain={remain}></IngredientAlert>);
                        }
                        return null;
                        }) : ""}
                </div>
            </div>
        )
    }
}

export default Notifications